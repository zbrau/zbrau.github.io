import React, { useState, useMemo, useEffect } from 'react';
import { Search, Home, Menu as MenuIcon, ShoppingBag, User as UserIcon, Bell, MapPin, Coins, QrCode, Check, X, LogOut, School, BookOpen, Users, ChevronRight, ArrowLeft, Loader2, Moon, Sun, ClipboardList, ShieldCheck, AlertCircle, DollarSign, Gift, Award, Sparkles, Flame, Clock, ChefHat, PackageCheck, History, Trash2 } from 'lucide-react';
import FoodItem from './components/FoodItem';
import Cart from './components/Cart';
import AIAssistant from './components/AIAssistant';
import { MENU_ITEMS, CATEGORIES } from './constants';
import { Category, MenuItem, CartItem, Screen, PickupTime, Order, OrderStatus, User, PaymentMethod } from './types';
// Firebase Imports
import { db } from './services/firebase';
// Removed modular imports in favor of compat object methods (db.collection...)

const App: React.FC = () => {
    // --- Authentication State ---
    
    // Objeto Admin constante para reutilizar (Backdoor local para acceso rápido)
    const ADMIN_USER: User = {
        name: 'Administrador',
        email: 'admin@ucol.mx',
        school: 'Administración',
        grade: '-',
        group: 'Staff',
        balance: 99999,
        loyaltyPoints: 9999
    };

    const [user, setUser] = useState<User | null>(null);
    const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
    const [isLoadingUser, setIsLoadingUser] = useState(true);

    // --- App State ---
    const [activeScreen, setActiveScreen] = useState<Screen>('HOME');
    const [selectedCategory, setSelectedCategory] = useState<Category>(Category.ALL);
    const [searchQuery, setSearchQuery] = useState('');
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);

    // Theme State
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
        }
        return 'light';
    });

    // Recharge State
    const [showRechargeModal, setShowRechargeModal] = useState(false);
    const [rechargeStep, setRechargeStep] = useState<'SELECT_AMOUNT' | 'SHOW_CODE'>('SELECT_AMOUNT');
    const [selectedRechargeAmount, setSelectedRechargeAmount] = useState<number>(0);
    const [rechargeCode, setRechargeCode] = useState('');
    const [customRechargeInput, setCustomRechargeInput] = useState('');

    // --- Admin Panel State ---
    const [adminSearchCode, setAdminSearchCode] = useState('');
    const [adminRechargeCode, setAdminRechargeCode] = useState('');
    const [adminFeedback, setAdminFeedback] = useState<{type: 'success'|'error', msg: string} | null>(null);
    const [isAdminProcessing, setIsAdminProcessing] = useState(false);
    const [adminTab, setAdminTab] = useState<'ACTIVE' | 'HISTORY' | 'RECHARGE'>('ACTIVE');
    const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);

    // --- User Orders State ---
    const [showUserClearHistoryModal, setShowUserClearHistoryModal] = useState(false);
    const [isUserProcessing, setIsUserProcessing] = useState(false);

    // --- Auth Form State ---
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');

    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPass, setRegPass] = useState('');
    const [regSchool, setRegSchool] = useState('');
    const [regGrade, setRegGrade] = useState('');
    const [regGroup, setRegGroup] = useState('');
    const [authError, setAuthError] = useState('');
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    // 0. Efecto de Tema
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    // 1. Efecto de inicialización: Revisar si hay sesión guardada y descargar datos frescos de Firebase
    useEffect(() => {
        const checkSession = async () => {
            const activeEmail = localStorage.getItem('activeSessionEmail');
            
            if (!activeEmail) {
                setIsLoadingUser(false);
                return;
            }

            if (activeEmail === 'admin@ucol.mx') {
                setUser(ADMIN_USER);
                setIsLoadingUser(false);
                return;
            }

            try {
                const docRef = db.collection("users").doc(activeEmail);
                const docSnap = await docRef.get();

                if (docSnap.exists) {
                    // Convertir datos de Firestore a nuestro tipo User
                    setUser(docSnap.data() as User);
                } else {
                    // Si el documento no existe (borrado?), cerrar sesión
                    localStorage.removeItem('activeSessionEmail');
                }
            } catch (error) {
                console.error("Error recuperando sesión:", error);
            } finally {
                setIsLoadingUser(false);
            }
        };

        checkSession();
    }, []);

    // 2. Efecto para escuchar cambios en el usuario (ej. balance actualizado en otro dispositivo)
    useEffect(() => {
        if (!user || user.email === 'admin@ucol.mx') return;

        const unsub = db.collection("users").doc(user.email).onSnapshot((doc: any) => {
            if (doc.exists) {
                setUser(doc.data() as User);
            }
        });

        return () => unsub();
    }, [user?.email]);

    // 3. Efecto para cargar pedidos (Diferente para Admin vs Usuario Normal)
    useEffect(() => {
        if (!user) return;
        setIsLoadingOrders(true);

        let q;
        if (user.email === 'admin@ucol.mx') {
            // ADMIN: Escuchar TODOS los pedidos, ordenados por fecha
            q = db.collection("orders").orderBy("timestamp", "desc");
        } else {
            // USUARIO: Escuchar SOLO sus pedidos
            q = db.collection("orders").where("userId", "==", user.email);
        }

        // Usar onSnapshot para tiempo real en ambos casos
        const unsubscribe = q.onSnapshot((snapshot: any) => {
            const fetchedOrders: Order[] = [];
            snapshot.forEach((doc: any) => {
                fetchedOrders.push(doc.data() as Order);
            });
            
            // Ordenar en cliente para asegurar consistencia (aunque el query ya lo haga)
            fetchedOrders.sort((a, b) => {
                const tsA = (a as any).timestamp || 0;
                const tsB = (b as any).timestamp || 0;
                return tsB - tsA;
            });

            setOrders(fetchedOrders);
            setIsLoadingOrders(false);
        }, (error: any) => {
            console.error("Error cargando pedidos:", error);
            setIsLoadingOrders(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        setIsAuthLoading(true);
        
        if (loginEmail === 'admin@ucol.mx' && loginPass === 'admin') {
            setUser(ADMIN_USER);
            localStorage.setItem('activeSessionEmail', 'admin@ucol.mx');
            setIsAuthLoading(false);
            return;
        }

        if (!loginEmail.endsWith('@ucol.mx')) {
            setAuthError('El correo debe terminar en @ucol.mx');
            setIsAuthLoading(false);
            return;
        }

        try {
            const docRef = db.collection("users").doc(loginEmail);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                const userData = docSnap.data();
                if (userData && userData.password === loginPass) {
                    const loggedUser = userData as User;
                    setUser(loggedUser);
                    localStorage.setItem('activeSessionEmail', loginEmail);
                } else {
                    setAuthError('Contraseña incorrecta.');
                }
            } else {
                setAuthError('No existe cuenta con este correo.');
            }
        } catch (err) {
            console.error(err);
            setAuthError('Error de conexión. Intenta de nuevo.');
        } finally {
            setIsAuthLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        setIsAuthLoading(true);
        
        if (!regEmail.endsWith('@ucol.mx')) {
            setAuthError('El correo debe ser institucional (@ucol.mx)');
            setIsAuthLoading(false);
            return;
        }

        if (!regName || !regPass || !regSchool || !regGrade || !regGroup) {
            setAuthError('Por favor completa todos los campos');
            setIsAuthLoading(false);
            return;
        }

        try {
            const docRef = db.collection("users").doc(regEmail);
            const docSnap = await docRef.get();
            
            if (docSnap.exists) {
                setAuthError('Este usuario ya está registrado.');
                setIsAuthLoading(false);
                return;
            }

            const newUser = {
                name: regName,
                email: regEmail,
                school: regSchool,
                grade: regGrade,
                group: regGroup,
                balance: 50,
                loyaltyPoints: 0, // Init points
                password: regPass
            };

            await db.collection("users").doc(regEmail).set(newUser);

            alert('¡Registro exitoso! Por favor inicia sesión.');
            setAuthMode('LOGIN');
            setLoginEmail(regEmail);
            
            setRegName('');
            setRegEmail('');
            setRegPass('');
            setRegSchool('');
            setRegGrade('');
            setRegGroup('');

        } catch (error) {
            console.error("Error al registrar:", error);
            setAuthError('Error guardando datos en la nube.');
        } finally {
            setIsAuthLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('activeSessionEmail');
        setUser(null);
        setCartItems([]);
        setOrders([]);
        setActiveScreen('HOME');
        setLoginPass('');
        setRegPass('');
        setLoginEmail('');
    };

    // --- Admin Logic ---
    const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
        setIsAdminProcessing(true);
        try {
            // Actualizar estado en la base de datos real
            const orderRef = db.collection("orders").doc(orderId);
            await orderRef.update({
                status: newStatus
            });
            console.log(`Pedido ${orderId} actualizado a ${newStatus} en base de datos.`);
        } catch (error) {
            console.error("Error updating order:", error);
            alert("No se pudo actualizar el estado. Intente de nuevo.");
        } finally {
            setIsAdminProcessing(false);
        }
    };

    const handleClearHistory = async () => {
        setIsAdminProcessing(true);
        try {
            // Get all completed orders
            const completedOrdersQuery = db.collection("orders").where("status", "==", OrderStatus.COMPLETED);
            const snapshot = await completedOrdersQuery.get();
            
            // Delete each completed order
            const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);
            
            console.log(`${snapshot.docs.length} completed orders deleted from history.`);
            setShowClearHistoryModal(false);
            setAdminFeedback({ type: 'success', msg: `Se eliminaron ${snapshot.docs.length} pedidos del historial.` });
            
            // Clear feedback after 3 seconds
            setTimeout(() => setAdminFeedback(null), 3000);
        } catch (error) {
            console.error("Error clearing history:", error);
            setAdminFeedback({ type: 'error', msg: 'No se pudo limpiar el historial. Intente de nuevo.' });
        } finally {
            setIsAdminProcessing(false);
        }
    };

    const handleUserClearHistory = async () => {
        if (!user) return;
        
        setIsUserProcessing(true);
        try {
            // Get only the current user's completed orders
            const userCompletedOrdersQuery = db.collection("orders")
                .where("userId", "==", user.email)
                .where("status", "==", OrderStatus.COMPLETED);
            const snapshot = await userCompletedOrdersQuery.get();
            
            // Delete each completed order
            const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);
            
            console.log(`${snapshot.docs.length} user completed orders deleted from history.`);
            setShowUserClearHistoryModal(false);
            
            // Show temporary success feedback (we could add a toast/alert here if needed)
            alert(`Se eliminaron ${snapshot.docs.length} pedidos completados del historial.`);
        } catch (error) {
            console.error("Error clearing user history:", error);
            alert('No se pudo limpiar el historial. Intente de nuevo.');
        } finally {
            setIsUserProcessing(false);
        }
    };

    const handleAdminLookup = async () => {
        if (!adminSearchCode.trim()) return;
        setIsAdminProcessing(true);
        setAdminFeedback(null);

        try {
            const q = db.collection("orders").where("pickupCode", "==", adminSearchCode.trim().toUpperCase());
            const querySnapshot = await q.get();

            if (querySnapshot.empty) {
                setAdminFeedback({ type: 'error', msg: 'Código no encontrado.' });
                setIsAdminProcessing(false);
                return;
            }

            const orderDoc = querySnapshot.docs[0];
            const orderData = orderDoc.data() as Order;

            if (orderData.status === OrderStatus.COMPLETED) {
                setAdminFeedback({ type: 'error', msg: 'Este pedido ya fue entregado.' });
                setIsAdminProcessing(false);
                return;
            }

            await db.collection("orders").doc(orderDoc.id).update({
                status: OrderStatus.COMPLETED
            });

            setAdminFeedback({ type: 'success', msg: `Pedido de ${orderData.items.length} items entregado correctamente.` });
            setAdminSearchCode(''); 

        } catch (error) {
            console.error("Admin lookup error:", error);
            setAdminFeedback({ type: 'error', msg: 'Error al conectar con la base de datos.' });
        } finally {
            setIsAdminProcessing(false);
        }
    };

    const handleAdminRecharge = async () => {
        if (!adminRechargeCode.trim()) return;
        setIsAdminProcessing(true);
        setAdminFeedback(null);

        try {
            const q = db.collection("recharge_requests").where("code", "==", adminRechargeCode.trim());
            const querySnapshot = await q.get();

            if (querySnapshot.empty) {
                setAdminFeedback({ type: 'error', msg: 'Código de recarga no encontrado o inválido.' });
                setIsAdminProcessing(false);
                return;
            }

            const reqDoc = querySnapshot.docs[0];
            const reqData = reqDoc.data();

            if (reqData.status === 'COMPLETED') {
                setAdminFeedback({ type: 'error', msg: 'Este código ya fue utilizado.' });
                setIsAdminProcessing(false);
                return;
            }

            // Update User Balance in DB
            const userRef = db.collection("users").doc(reqData.userId);
            const userSnap = await userRef.get();

            if (userSnap.exists) {
                const currentBalance = userSnap.data()?.balance || 0;
                await userRef.update({
                    balance: currentBalance + reqData.amount
                });

                // Update Request Status in DB
                await db.collection("recharge_requests").doc(reqDoc.id).update({
                    status: 'COMPLETED',
                    processedAt: Date.now()
                });

                setAdminFeedback({ type: 'success', msg: `Recarga de ${reqData.amount} UC exitosa para ${reqData.userName}.` });
                setAdminRechargeCode('');
            } else {
                setAdminFeedback({ type: 'error', msg: 'Usuario no encontrado.' });
            }

        } catch (error) {
            console.error("Admin recharge error:", error);
            setAdminFeedback({ type: 'error', msg: 'Error procesando la recarga.' });
        } finally {
            setIsAdminProcessing(false);
        }
    };

    // --- Main Logic ---

    const filteredItems = useMemo(() => {
        return MENU_ITEMS.filter(item => {
            const matchesCategory = selectedCategory === Category.ALL || item.category === selectedCategory;
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                  item.description.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [selectedCategory, searchQuery]);

    const addToCart = (item: MenuItem) => {
        setCartItems(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...item, quantity: 1 }];
        });
        setTimeout(() => setIsCartOpen(true), 10);
    };

    const updateQuantity = (id: string, delta: number) => {
        setCartItems(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, quantity: Math.max(0, item.quantity + delta) };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const handleCheckout = async (pickupTime: string, pointsRedeemed: number = 0, discount: number = 0, paymentMethod: PaymentMethod = PaymentMethod.CASH) => {
        if (!user) return;
        const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = Math.max(0, subtotal - discount);

        // Only check balance if paying with Ucol Coins
        if (paymentMethod === PaymentMethod.UCOL_COINS && total > user.balance) {
            alert("¡Oh no! Te faltan Ucol Coins. Genera un código de recarga en tu perfil.");
            return;
        }

        const currentPoints = user.loyaltyPoints || 0;
        if (pointsRedeemed > 0 && currentPoints < pointsRedeemed) {
             alert("No tienes suficientes puntos para canjear esta recompensa.");
             return;
        }

        const pointsEarned = Math.floor(total);
        const newBalance = paymentMethod === PaymentMethod.UCOL_COINS ? user.balance - total : user.balance;
        const newPoints = currentPoints - pointsRedeemed + pointsEarned;

        const pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        const tempOrder: Order = {
            id: Math.random().toString(36).substr(2, 9),
            items: [...cartItems],
            total,
            subtotal,
            discount,
            pointsEarned,
            pointsRedeemed,
            status: OrderStatus.PENDING,
            date: new Date().toLocaleDateString(),
            pickupTime,
            userId: user.email,
            pickupCode,
            paymentMethod
        };

        try {
            // Guardar en Firebase (Base de Datos Real)
            const orderRef = await db.collection("orders").add({
                ...tempOrder,
                date: new Date().toLocaleDateString(),
                timestamp: Date.now()
            });
            
            await orderRef.update({ id: orderRef.id });

            // Si el usuario es admin, actualizamos su saldo local de prueba, 
            // pero para usuarios normales actualizamos su documento en la BD.
            if (user.email === 'admin@ucol.mx') {
                 setUser({ ...user, balance: newBalance, loyaltyPoints: newPoints });
            } else {
                const userRef = db.collection("users").doc(user.email);
                await userRef.update({
                    balance: newBalance,
                    loyaltyPoints: newPoints
                });
            }

            setCartItems([]);
            setIsCartOpen(false);
            setActiveScreen('ORDERS');
            
            let msg = paymentMethod === PaymentMethod.CASH
                ? `¡Pedido confirmado! Paga en efectivo al recoger: ${pickupTime}.`
                : `¡Pedido confirmado! Pasa a recogerlo: ${pickupTime}.`;
            if (pointsRedeemed > 0) msg += ` ¡Disfruta tu recompensa!`;
            else msg += ` Ganaste ${pointsEarned} puntos.`;
            
            alert(msg);

        } catch (error) {
            console.error("Error procesando pedido:", error);
            alert("Error de conexión al procesar el pedido.");
        }
    };

    const openRechargeModal = () => {
        setRechargeStep('SELECT_AMOUNT');
        setSelectedRechargeAmount(0);
        setCustomRechargeInput('');
        setShowRechargeModal(true);
    };

    const handleSelectAmount = async (amount: number) => {
        setSelectedRechargeAmount(amount);
        // Generar un código aleatorio
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const code = `UCOL-${amount}-${randomSuffix}`;
        setRechargeCode(code);
        setRechargeStep('SHOW_CODE');

        // Guardar solicitud en Firestore para que el Admin la valide
        if (user && user.email !== 'admin@ucol.mx') {
            try {
                await db.collection("recharge_requests").add({
                    code,
                    amount,
                    userId: user.email,
                    userName: user.name,
                    status: 'PENDING',
                    createdAt: new Date().toISOString()
                });
            } catch (error) {
                console.error("Error creating recharge request:", error);
            }
        }
    };

    const handleFinishRecharge = async () => {
        setShowRechargeModal(false);
        if (!user || user.email === 'admin@ucol.mx') return;

        // Nota: En una app real, aquí se integraría Stripe o PayPal.
        // Por ahora, simulamos el abono directo a la base de datos para la demo.
        try {
            const userRef = db.collection("users").doc(user.email);
            const newBalance = user.balance + selectedRechargeAmount;
            await userRef.update({
                balance: newBalance
            });
            alert(`¡Recarga exitosa! Se han abonado ${selectedRechargeAmount} UC a tu cuenta en la nube.`);
        } catch (error) {
            console.error("Error recarga:", error);
        }
    };

    // --- Render: Loading Screen ---
    if (isLoadingUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
            </div>
        );
    }

    // --- Render: Auth Screens ---
    if (!user) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 font-sans transition-colors w-full">
                <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-green-700 to-emerald-600 p-8 text-center text-white relative">
                         <button 
                            onClick={toggleTheme} 
                            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-sm transition-colors text-white"
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg p-2 overflow-hidden">
                             <img 
                                src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Logo_de_la_Universidad_de_Colima.svg/640px-Logo_de_la_Universidad_de_Colima.svg.png" 
                                alt="UCol Logo" 
                                className="w-full h-full object-contain"
                             />
                        </div>
                        <h1 className="text-2xl font-bold mb-1">Aperativo</h1>
                        <p className="text-white/80 text-sm">Cafetería Universidad de Colima</p>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-100 dark:border-gray-700">
                        <button 
                            onClick={() => setAuthMode('LOGIN')}
                            className={`flex-1 py-4 text-sm font-bold transition-colors ${authMode === 'LOGIN' ? 'text-green-700 dark:text-green-400 border-b-2 border-green-700 dark:border-green-400' : 'text-gray-400 dark:text-gray-500'}`}
                        >
                            Iniciar Sesión
                        </button>
                        <button 
                            onClick={() => setAuthMode('REGISTER')}
                            className={`flex-1 py-4 text-sm font-bold transition-colors ${authMode === 'REGISTER' ? 'text-green-700 dark:text-green-400 border-b-2 border-green-700 dark:border-green-400' : 'text-gray-400 dark:text-gray-500'}`}
                        >
                            Crear Cuenta
                        </button>
                    </div>

                    {/* Form Area */}
                    <div className="p-8 bg-white dark:bg-gray-800 transition-colors">
                        {authError && (
                            <div className="mb-4 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-300 text-xs p-3 rounded-lg flex items-center gap-2">
                                <X size={14} />
                                {authError}
                            </div>
                        )}

                        {authMode === 'LOGIN' ? (
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Correo Institucional</label>
                                    <input 
                                        type="email" 
                                        placeholder="estudiante@ucol.mx" 
                                        className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-green-500 dark:focus:border-green-400 transition-colors"
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Contraseña</label>
                                    <input 
                                        type="password" 
                                        placeholder="••••••••" 
                                        className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-green-500 dark:focus:border-green-400 transition-colors"
                                        value={loginPass}
                                        onChange={(e) => setLoginPass(e.target.value)}
                                        required
                                    />
                                </div>
                                <button 
                                    type="submit" 
                                    disabled={isAuthLoading}
                                    className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-green-200 dark:shadow-none transition mt-4 flex justify-center items-center gap-2 disabled:opacity-70"
                                >
                                    {isAuthLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Entrar
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleRegister} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Nombre Completo</label>
                                    <input type="text" placeholder="Juan Pérez" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-green-500 dark:focus:border-green-400 transition-colors" 
                                        value={regName} onChange={e => setRegName(e.target.value)} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Correo (@ucol.mx)</label>
                                    <input type="email" placeholder="juan@ucol.mx" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-green-500 dark:focus:border-green-400 transition-colors" 
                                        value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Contraseña</label>
                                    <input type="password" placeholder="••••••••" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-green-500 dark:focus:border-green-400 transition-colors" 
                                        value={regPass} onChange={e => setRegPass(e.target.value)} required />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Bachillerato</label>
                                        <div className="relative">
                                            <School className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                            <input type="text" placeholder="Bach 1" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-green-500 dark:focus:border-green-400 transition-colors" 
                                                value={regSchool} onChange={e => setRegSchool(e.target.value)} required />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Grado</label>
                                        <div className="relative">
                                            <BookOpen className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                            <input type="text" placeholder="4°" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-green-500 dark:focus:border-green-400 transition-colors" 
                                                value={regGrade} onChange={e => setRegGrade(e.target.value)} required />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Grupo</label>
                                    <div className="relative">
                                        <Users className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                        <input type="text" placeholder="A" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-green-500 dark:focus:border-green-400 transition-colors" 
                                            value={regGroup} onChange={e => setRegGroup(e.target.value)} required />
                                    </div>
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={isAuthLoading}
                                    className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-green-200 dark:shadow-none transition mt-2 flex justify-center items-center gap-2 disabled:opacity-70"
                                >
                                    {isAuthLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Registrarse
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // --- Sub-components for Screen Rendering ---

    const RechargeModal = () => {
        if (!showRechargeModal) return null;
        // (Modal code is identical to previous, just rendering)
        return (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRechargeModal(false)} />
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-sm relative z-10 shadow-2xl animate-bounce-in border border-gray-100 dark:border-gray-700 transition-colors">
                    <button onClick={() => setShowRechargeModal(false)} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X size={24} />
                    </button>

                    {rechargeStep === 'SELECT_AMOUNT' ? (
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mb-1">
                                <Coins size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Elige la cantidad</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                ¿Cuántos Ucol Coins quieres recargar hoy?
                            </p>

                            <div className="grid grid-cols-2 gap-3 w-full">
                                {[20, 50, 100, 200].map((amount) => (
                                    <button
                                        key={amount}
                                        onClick={() => handleSelectAmount(amount)}
                                        className="bg-white dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-700 dark:text-gray-200 font-bold py-4 rounded-xl transition-all flex flex-col items-center justify-center gap-1 shadow-sm"
                                    >
                                        <span className="text-2xl text-green-700 dark:text-green-400">{amount} UC</span>
                                        <span className="text-xs font-normal text-gray-400">${amount}.00 MXN</span>
                                    </button>
                                ))}
                                <button
                                     onClick={() => handleSelectAmount(500)}
                                     className="col-span-2 bg-white dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-700 dark:text-gray-200 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <span className="text-xl text-green-700 dark:text-green-400">500 UC</span>
                                    <span className="text-xs font-normal text-gray-400">(${500}.00 MXN)</span>
                                </button>
                            </div>

                            {/* Custom Amount Section */}
                            <div className="w-full mt-2 border-t border-gray-100 dark:border-gray-700 pt-4">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">Monto Personalizado</label>
                                    <span className="text-[10px] text-gray-400 font-medium bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">1 MXN = 1 UC</span>
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm font-bold">UC</span>
                                        <input 
                                            type="number" 
                                            value={customRechargeInput}
                                            onChange={(e) => setCustomRechargeInput(e.target.value)}
                                            placeholder="0"
                                            min="1"
                                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:focus:ring-green-900/30 transition-all"
                                        />
                                    </div>
                                    <button 
                                        onClick={() => {
                                            const val = Math.floor(parseFloat(customRechargeInput));
                                            if (val > 0) handleSelectAmount(val);
                                        }}
                                        disabled={!customRechargeInput || parseFloat(customRechargeInput) <= 0}
                                        className="bg-gray-800 dark:bg-gray-600 hover:bg-gray-900 dark:hover:bg-gray-500 text-white px-6 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Generar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-center space-y-4">
                            <button 
                                onClick={() => setRechargeStep('SELECT_AMOUNT')}
                                className="absolute top-4 left-4 p-1 text-gray-400 hover:text-green-600"
                            >
                                <ArrowLeft size={24} />
                            </button>

                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mb-2">
                                <QrCode size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Código de Recarga</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                Muestra este código en la <span className="font-bold text-gray-700 dark:text-gray-200">Dirección Escolar</span>.
                            </p>
                            
                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800 w-full">
                                <p className="text-xs text-green-600 dark:text-green-400 uppercase font-bold mb-1">Monto a Pagar</p>
                                <p className="text-3xl font-bold text-green-800 dark:text-green-300">${selectedRechargeAmount}.00</p>
                            </div>

                            <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 w-full">
                                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Código</p>
                                <p className="text-2xl font-mono font-bold text-gray-800 dark:text-white tracking-widest break-all">{rechargeCode}</p>
                            </div>
                            
                            <div className="text-xs text-gray-400">
                                Tu saldo se actualizará en cuanto pagues.
                            </div>

                            <button 
                                onClick={handleFinishRecharge}
                                className="w-full bg-gray-900 dark:bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition"
                            >
                                Listo, Entendido
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const AdminScreen = () => {
        // Filtramos las órdenes en cliente
        const activeOrders = orders.filter(o => o.status !== OrderStatus.COMPLETED);
        const historyOrders = orders.filter(o => o.status === OrderStatus.COMPLETED);

        return (
        <>
        <div className="pb-24 animate-fade-in max-w-5xl mx-auto w-full">
             <div className="bg-white dark:bg-gray-900 p-6 shadow-sm sticky top-0 z-10 transition-colors rounded-xl mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setActiveScreen('HOME')} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                            <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Panel de Cocina</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Administración de Cafetería</p>
                        </div>
                    </div>
                    
                    {/* Tabs de Navegación Admin */}
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        <button 
                            onClick={() => setAdminTab('ACTIVE')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${adminTab === 'ACTIVE' ? 'bg-white dark:bg-gray-700 text-green-700 dark:text-green-400 shadow-sm' : 'text-gray-500'}`}
                        >
                            <div className="flex items-center gap-2">
                                <ChefHat size={16} />
                                Activos ({activeOrders.length})
                            </div>
                        </button>
                        <button 
                            onClick={() => setAdminTab('HISTORY')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${adminTab === 'HISTORY' ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-gray-500'}`}
                        >
                             <div className="flex items-center gap-2">
                                <History size={16} />
                                Historial
                            </div>
                        </button>
                         <button 
                            onClick={() => setAdminTab('RECHARGE')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${adminTab === 'RECHARGE' ? 'bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-gray-500'}`}
                        >
                             <div className="flex items-center gap-2">
                                <DollarSign size={16} />
                                Recargas
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                
                {/* --- TAB: PEDIDOS ACTIVOS (KITCHEN DISPLAY) --- */}
                {adminTab === 'ACTIVE' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeOrders.length === 0 ? (
                            <div className="col-span-full py-20 text-center text-gray-400">
                                <ChefHat className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                <p className="text-lg font-medium">No hay pedidos pendientes</p>
                                <p className="text-sm">¡La cocina está tranquila!</p>
                            </div>
                        ) : (
                            activeOrders.map(order => (
                                <div key={order.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md border-l-4 border-l-green-500 overflow-hidden flex flex-col h-full animate-fade-in relative">
                                    {/* Cabecera del Ticket */}
                                    <div className={`p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start`}>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xl font-bold text-gray-800 dark:text-white">#{order.pickupCode || order.id.slice(0,4)}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                                    order.status === OrderStatus.PENDING ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                                    'bg-green-100 text-green-700 border-green-200'
                                                }`}>
                                                    {order.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">{order.userId}</p>
                                            {order.paymentMethod && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
                                                    order.paymentMethod === PaymentMethod.CASH
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                }`}>
                                                    {order.paymentMethod === PaymentMethod.CASH ? '💵 Efectivo' : '🪙 Ucol Coins'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400 font-mono">{order.pickupTime}</p>
                                            <p className="text-xs font-bold text-gray-600 dark:text-gray-300">{order.date}</p>
                                        </div>
                                    </div>

                                    {/* Lista de Items */}
                                    <div className="p-4 flex-1 space-y-3 overflow-y-auto max-h-[300px]">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex items-start gap-3">
                                                <div className="bg-gray-100 dark:bg-gray-700 w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-gray-700 dark:text-white shrink-0">
                                                    {item.quantity}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-800 dark:text-white leading-tight">{item.name}</p>
                                                    {item.note && <p className="text-xs text-red-500 italic mt-0.5">Nota: {item.note}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Acciones */}
                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 grid grid-cols-1 gap-2">
                                        {order.status === OrderStatus.PENDING && (
                                            <button
                                                onClick={() => handleUpdateOrderStatus(order.id, OrderStatus.COMPLETED)}
                                                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <Check size={16} />
                                                Pedido Entregado
                                            </button>
                                        )}
                                        <div className="text-center text-[10px] text-gray-400 mt-1">
                                            ID: {order.id}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* --- TAB: HISTORIAL --- */}
                {adminTab === 'HISTORY' && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        {/* Header with Clear Button */}
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Historial de Pedidos</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{historyOrders.length} pedidos completados</p>
                            </div>
                            {historyOrders.length > 0 && (
                                <button
                                    onClick={() => setShowClearHistoryModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition-colors"
                                >
                                    <Trash2 size={16} />
                                    Limpiar Historial
                                </button>
                            )}
                        </div>
                         <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                    <tr>
                                        <th className="px-6 py-3">Código</th>
                                        <th className="px-6 py-3">Usuario</th>
                                        <th className="px-6 py-3">Items</th>
                                        <th className="px-6 py-3">Total</th>
                                        <th className="px-6 py-3">Pago</th>
                                        <th className="px-6 py-3">Fecha</th>
                                        <th className="px-6 py-3">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyOrders.map((order) => (
                                        <tr key={order.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                            <td className="px-6 py-4 font-mono font-bold text-gray-900 dark:text-white">
                                                {order.pickupCode || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {order.userId}
                                            </td>
                                            <td className="px-6 py-4">
                                                {order.items.map(i => `${i.quantity} ${i.name}`).join(', ')}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-green-600">
                                                {order.total} UC
                                            </td>
                                            <td className="px-6 py-4 text-xs">
                                                {order.paymentMethod === PaymentMethod.CASH ? 'Efectivo' : order.paymentMethod === PaymentMethod.UCOL_COINS ? 'Ucol Coins' : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {order.date}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-gray-700 dark:text-gray-300">
                                                    Entregado
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {historyOrders.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                                                No hay historial de pedidos completados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}


                {/* --- TAB: RECARGAS Y COMPLETAR POR CODIGO --- */}
                {adminTab === 'RECHARGE' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Completar Pedidos Section */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-fit">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                                    <ClipboardList className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-white text-lg">Búsqueda Rápida</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs">Ingresa el código del alumno</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Código de Recolección
                                    </label>
                                    <input
                                        type="text"
                                        value={adminSearchCode}
                                        onChange={(e) => setAdminSearchCode(e.target.value.toUpperCase())}
                                        placeholder="Ej: X7Z9A2"
                                        className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-center text-2xl font-mono font-bold text-gray-800 dark:text-white tracking-widest outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                                        maxLength={6}
                                    />
                                </div>

                                {adminFeedback && !adminFeedback.msg.includes('Recarga') && (
                                    <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${adminFeedback.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                        {adminFeedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                        {adminFeedback.msg}
                                    </div>
                                )}

                                <button
                                    onClick={handleAdminLookup}
                                    disabled={isAdminProcessing || !adminSearchCode}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isAdminProcessing && !adminRechargeCode ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                    Buscar y Entregar
                                </button>
                            </div>
                        </div>

                        {/* Recargas Section */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-fit">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-full">
                                    <DollarSign className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-white text-lg">Recargas de Saldo</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs">Validar pago de Ucol Coins</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Código de Recarga
                                    </label>
                                    <input
                                        type="text"
                                        value={adminRechargeCode}
                                        onChange={(e) => setAdminRechargeCode(e.target.value)}
                                        placeholder="Ej: UCOL-50-1234"
                                        className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-center text-lg font-mono font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                {adminFeedback && adminFeedback.msg.includes('Recarga') && (
                                    <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${adminFeedback.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                        {adminFeedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                        {adminFeedback.msg}
                                    </div>
                                )}

                                <button
                                    onClick={handleAdminRecharge}
                                    disabled={isAdminProcessing || !adminRechargeCode}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isAdminProcessing && !!adminRechargeCode ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
                                    Validar Recarga
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Clear History Confirmation Modal */}
        {showClearHistoryModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* Backdrop */}
                <div 
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
                    onClick={() => setShowClearHistoryModal(false)}
                />
                
                {/* Modal */}
                <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-fade-in">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
                                ¿Limpiar Historial?
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Esta acción eliminará permanentemente <span className="font-bold text-red-600 dark:text-red-400">{historyOrders.length} pedidos</span> del historial. Esta acción no se puede deshacer.
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowClearHistoryModal(false)}
                            disabled={isAdminProcessing}
                            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleClearHistory}
                            disabled={isAdminProcessing}
                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isAdminProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Eliminando...
                                </>
                            ) : (
                                <>
                                    <Trash2 size={16} />
                                    Sí, Limpiar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
    };

    const HomeScreen = () => {
        const points = user?.loyaltyPoints || 0;
        const pointsTarget = 200;
        const pointsPercent = Math.min(100, (points / pointsTarget) * 100);

        return (
            <div className="space-y-6 pb-24 md:pb-8">
                {/* Desktop Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                    {/* Main Left Column */}
                    <div className="lg:col-span-2 space-y-6">
                        
                         {/* Mobile Top: Search Bar */}
                         <div className="lg:hidden mt-2 relative">
                             <input 
                                type="text" 
                                placeholder="¿Qué se te antoja hoy?" 
                                className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 shadow-sm"
                                onClick={() => { setActiveScreen('MENU'); }}
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                         </div>

                         {/* Hero / Banner */}
                        <div className="bg-gradient-to-r from-green-700 to-emerald-600 rounded-2xl md:rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden mt-2 md:mt-0 min-h-[160px] md:min-h-auto flex flex-col justify-center">
                            {/* Desktop Background Icon */}
                            <div className="hidden md:block absolute right-[-20px] bottom-[-40px] opacity-20 transform rotate-12">
                                <ShoppingBag size={180} />
                            </div>
                            
                            {/* Mobile Image Background (Styled like UberEats Promo) */}
                            <div className="md:hidden absolute inset-0 z-0">
                                <img src="https://images.unsplash.com/photo-1594041680534-e8c8cdebd659?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover opacity-20 mix-blend-overlay" alt="Food bg" />
                                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent"></div>
                            </div>

                            <div className="relative z-10 max-w-lg">
                                <span className="inline-block bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold mb-2 uppercase tracking-wide">
                                    ¡Evita filas!
                                </span>
                                <h2 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">
                                    Hola, {user?.name.split(' ')[0]} 👋
                                </h2>
                                <p className="mb-6 opacity-90 text-sm md:text-base leading-relaxed max-w-[80%]">
                                    Aparta tu desayuno ahora para el recreo de las 9:30.
                                </p>
                                
                                <button 
                                    onClick={() => setActiveScreen('MENU')}
                                    className="inline-flex items-center gap-2 bg-white text-green-800 px-6 py-2.5 rounded-full text-sm font-bold hover:bg-gray-50 transition shadow-lg active:scale-95 transform"
                                >
                                    Ver Menú
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>

                         {/* Mobile Admin Button - Sleeker Glassmorphism Style */}
                         {user?.email === 'admin@ucol.mx' && (
                             <div className="lg:hidden">
                                <button 
                                    onClick={() => setActiveScreen('ADMIN_PANEL')}
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 p-1 rounded-2xl shadow-lg group relative overflow-hidden"
                                >
                                    <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-white/20 p-2.5 rounded-xl shadow-inner">
                                                <ShieldCheck className="w-6 h-6 text-white" />
                                            </div>
                                            <div className="text-left text-white">
                                                <h3 className="font-bold text-base">Panel Admin</h3>
                                                <p className="text-blue-100 text-xs opacity-80">Gestionar cafetería</p>
                                            </div>
                                        </div>
                                        <div className="bg-white/20 p-2 rounded-full">
                                            <ChevronRight className="w-5 h-5 text-white" />
                                        </div>
                                    </div>
                                </button>
                             </div>
                        )}

                        {/* Mobile Loyalty Card - Compact & Modern */}
                        <div className="lg:hidden">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group flex items-center gap-4">
                                {/* Circular Progress */}
                                <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-100 dark:text-gray-700" />
                                        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={175} strokeDashoffset={175 - (175 * pointsPercent) / 100} className="text-orange-500 transition-all duration-1000" />
                                    </svg>
                                    <Award size={20} className="text-orange-500 absolute" />
                                </div>
                                
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-gray-800 dark:text-white font-bold text-sm">Aperativo Rewards</h3>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                                {points >= pointsTarget ? "¡Comida gratis disponible!" : `Te faltan ${pointsTarget - points} pts para tu premio.`}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-lg font-bold text-orange-500">{points}</span>
                                            <span className="text-[10px] text-gray-400 block uppercase">Puntos</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                         {/* Categories - Horizontal Scroll Pill Design */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-gray-800 dark:text-white text-lg">Categorías</h3>
                            </div>
                            
                            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 md:mx-0 md:px-0">
                                {CATEGORIES.filter(c => c !== Category.ALL).map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => { setSelectedCategory(cat); setActiveScreen('MENU'); }}
                                        className="flex-shrink-0 flex items-center gap-2 pl-2 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full shadow-sm active:scale-95 transition-all"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-sm">
                                            {cat === Category.BREAKFAST && '🍳'}
                                            {cat === Category.LUNCH && '🍔'}
                                            {cat === Category.SNACKS && '🍟'}
                                            {cat === Category.DRINKS && '🥤'}
                                            {cat === Category.HEALTHY && '🥗'}
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{cat}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Popular Items */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-gray-800 dark:text-white text-lg flex items-center gap-2">
                                    <Flame size={18} className="text-orange-500 fill-current" />
                                    Más pedidos
                                </h3>
                                <button onClick={() => setActiveScreen('MENU')} className="text-green-600 dark:text-green-400 text-sm font-medium hover:underline">Ver todo</button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                {MENU_ITEMS.filter(i => i.isPopular).slice(0, 4).map(item => (
                                    <FoodItem key={item.id} item={item} onAdd={addToCart} />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Desktop Sidebar) */}
                    <div className="hidden lg:block space-y-6">
                         {/* Desktop Loyalty Widget */}
                         <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-orange-100 dark:border-orange-900/30 shadow-md relative overflow-hidden group transition-colors">
                            <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Award size={120} className="text-orange-500" />
                            </div>
                            
                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <div>
                                    <h3 className="text-orange-600 dark:text-orange-400 font-bold flex items-center gap-2 text-lg">
                                        <Gift size={20} />
                                        Rewards
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Acumula puntos y come gratis.
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-4xl font-bold text-gray-800 dark:text-white">{points}</span>
                                    <span className="text-xs text-gray-400 block uppercase tracking-wide">Puntos</span>
                                </div>
                            </div>

                            <div className="relative z-10 space-y-2">
                                <div className="flex justify-between text-xs text-gray-500 mb-1 font-medium">
                                    <span>Nivel Comensal</span>
                                    <span>{points}/{pointsTarget}</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                                    <div 
                                        className="bg-gradient-to-r from-orange-400 to-orange-600 h-4 rounded-full shadow-sm transition-all duration-1000 ease-out" 
                                        style={{ width: `${pointsPercent}%` }}
                                    ></div>
                                </div>
                                <p className="text-xs text-center text-gray-400 pt-2">
                                    {points >= pointsTarget 
                                    ? "¡Felicidades! Tienes una recompensa disponible." 
                                    : `Solo ${pointsTarget - points} puntos más para tu premio.`}
                                </p>
                            </div>
                        </div>

                         {/* Admin Quick Link */}
                         {user?.email === 'admin@ucol.mx' && (
                            <button 
                                onClick={() => setActiveScreen('ADMIN_PANEL')}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-3xl shadow-lg flex items-center justify-between group transition-all"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="bg-white/20 p-3 rounded-xl">
                                        <ShieldCheck className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-lg">Panel Admin</h3>
                                        <p className="text-blue-100 text-xs">Gestionar cafetería</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-6 h-6 text-white/70 group-hover:translate-x-1 transition-transform" />
                            </button>
                         )}

                         {/* Mini Profile Summary */}
                         <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                             <div className="flex items-center gap-4 mb-4">
                                 <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-700 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                     {user?.name.charAt(0)}
                                 </div>
                                 <div>
                                     <h4 className="font-bold text-gray-800 dark:text-white">{user?.name}</h4>
                                     <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                                 </div>
                             </div>
                             <button 
                                onClick={() => setActiveScreen('PROFILE')}
                                className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                             >
                                 Ver Perfil Completo
                             </button>
                         </div>
                    </div>
                </div>
            </div>
        );
    };

    const MenuScreen = () => (
        <div className="pb-24 pt-4 space-y-4 h-full">
            {/* Search & Filter */}
            <div className="sticky top-[72px] md:top-20 bg-[#f3f4f6] dark:bg-gray-950 z-20 pb-4 space-y-4 transition-colors">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative w-full md:max-w-md">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="Buscar molletes, tacos, jugos..." 
                            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:text-white transition-colors shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="w-full md:w-auto overflow-x-auto no-scrollbar">
                        <div className="flex gap-2">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                                        selectedCategory === cat 
                                        ? 'bg-green-700 text-white shadow-md' 
                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {filteredItems.length > 0 ? (
                    filteredItems.map(item => (
                        <FoodItem key={item.id} item={item} onAdd={addToCart} />
                    ))
                ) : (
                    <div className="col-span-full text-center py-20">
                         <div className="bg-gray-100 dark:bg-gray-800 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                             <Search className="w-10 h-10 text-gray-400" />
                         </div>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">No encontramos nada con ese nombre :(</p>
                    </div>
                )}
            </div>
        </div>
    );

    const OrdersScreen = () => {
        // Filter completed orders for this user
        const userCompletedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED);
        
        return (
        <>
        <div className="pt-6 pb-24 space-y-6 max-w-3xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Mis Pedidos</h2>
                {userCompletedOrders.length > 0 && (
                    <button
                        onClick={() => setShowUserClearHistoryModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition-colors"
                    >
                        <Trash2 size={16} />
                        Limpiar Historial
                    </button>
                )}
            </div>
            {isLoadingOrders ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-green-600 w-8 h-8"/></div>
            ) : orders.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="bg-gray-100 dark:bg-gray-800 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 transition-colors">
                        <ShoppingBag className="text-gray-400 dark:text-gray-500 w-12 h-12" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Sin pedidos recientes</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto">Aún no has realizado pedidos. Explora nuestro menú y pide algo delicioso.</p>
                    <button onClick={() => setActiveScreen('MENU')} className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-bold transition">Ir a ordenar</button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {orders.map(order => (
                        <div key={order.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors hover:shadow-md">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                                            order.status === OrderStatus.COMPLETED ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200' :
                                            'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200'
                                        }`}>
                                            {order.status}
                                        </span>
                                        <p className="text-sm text-gray-400">{order.date}</p>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Recoger: <span className="text-green-700 dark:text-green-400 font-bold">{order.pickupTime}</span></p>
                                    {order.paymentMethod && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            Pago: <span className="font-medium">{order.paymentMethod === PaymentMethod.CASH ? '💵 Efectivo' : '🪙 Ucol Coins'}</span>
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col items-end">
                                    <div className="flex items-center gap-2 font-bold text-xl text-gray-800 dark:text-white">
                                        <Coins size={20} className="text-green-600 dark:text-green-400" />
                                        {order.total.toFixed(0)} UC
                                    </div>
                                    {order.discount && order.discount > 0 && (
                                        <span className="text-xs text-orange-500 font-bold flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">
                                            <Gift size={10} /> Ahorro -{order.discount}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {order.status !== OrderStatus.COMPLETED && order.pickupCode && (
                                <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white dark:bg-blue-900/50 p-2 rounded-lg">
                                            <QrCode className="w-6 h-6 text-blue-700 dark:text-blue-300" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-blue-600 dark:text-blue-300 uppercase font-bold tracking-wide">Código de Recolección</p>
                                            <p className="text-xs text-blue-400 dark:text-blue-500">Muestra esto al recoger</p>
                                        </div>
                                    </div>
                                    <span className="text-3xl font-mono font-bold text-blue-800 dark:text-blue-200 tracking-widest bg-white dark:bg-gray-900 px-4 py-1 rounded-lg shadow-sm border border-blue-100 dark:border-blue-900/50">
                                        {order.pickupCode}
                                    </span>
                                </div>
                            )}

                            <div className="border-t border-gray-50 dark:border-gray-700 mt-2 pt-4">
                                <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                                    {order.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between">
                                            <span>{item.quantity}x {item.name}</span>
                                            <span className="text-gray-300 dark:text-gray-600">{(item.price * item.quantity).toFixed(0)} UC</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))
                }
                </div>
            )}
        </div>

        {/* User Clear History Confirmation Modal */}
        {showUserClearHistoryModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* Backdrop */}
                <div 
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
                    onClick={() => setShowUserClearHistoryModal(false)}
                />
                
                {/* Modal */}
                <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-fade-in">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
                                ¿Limpiar Historial de Pedidos?
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Esta acción eliminará permanentemente <span className="font-bold text-red-600 dark:text-red-400">{userCompletedOrders.length} pedidos completados</span> de tu historial. Esta acción no se puede deshacer.
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowUserClearHistoryModal(false)}
                            disabled={isUserProcessing}
                            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleUserClearHistory}
                            disabled={isUserProcessing}
                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isUserProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Eliminando...
                                </>
                            ) : (
                                <>
                                    <Trash2 size={16} />
                                    Sí, Limpiar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
        );
    };

    const ProfileScreen = () => (
        <div className="px-4 pt-6 pb-24 max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 text-center sm:text-left">
                <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-4xl shadow-lg ring-4 ring-white dark:ring-gray-800">
                    {user.name.charAt(0)}
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-1">{user.name}</h2>
                    <p className="text-lg text-gray-500 dark:text-gray-400 mb-2">{user.school} • {user.grade}{user.group}</p>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium text-gray-500 dark:text-gray-400">
                         {user.email}
                    </div>
                </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-black dark:to-gray-900 rounded-3xl p-8 text-white mb-8 shadow-2xl relative overflow-hidden group">
                <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-8">
                        <div>
                            <p className="text-sm opacity-60 mb-2 font-medium uppercase tracking-wider flex items-center gap-2">
                                <Coins size={16} />
                                Saldo Disponible
                            </p>
                            <h3 className="text-5xl font-bold tracking-tight">{user.balance.toFixed(0)} UC</h3>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm px-4 py-3 rounded-2xl text-center min-w-[100px] border border-white/5">
                             <p className="text-[10px] opacity-70 uppercase tracking-wider mb-1">Puntos</p>
                             <p className="font-bold text-2xl text-orange-400">{user.loyaltyPoints || 0}</p>
                        </div>
                    </div>
                    <button 
                        onClick={openRechargeModal}
                        className="bg-green-500 hover:bg-green-400 text-white w-full py-4 rounded-2xl text-base font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-green-900/20 transform active:scale-[0.99]"
                    >
                        <QrCode size={20} />
                        Recargar Saldo
                    </button>
                </div>
                {/* Background Decorations */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>
            </div>

            <div className="space-y-3">
                 {/* Admin Link for Mobile Backup */}
                 {user?.email === 'admin@ucol.mx' && (
                     <button 
                        onClick={() => setActiveScreen('ADMIN_PANEL')}
                        className="w-full bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-center justify-between text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                <ShieldCheck size={20} />
                            </div>
                            <span className="font-bold text-base">Panel de Administrador</span>
                        </div>
                        <ChevronRight size={20} className="text-blue-400" />
                    </button>
                )}

                <button 
                    onClick={toggleTheme}
                    className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center justify-between text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-gray-100 text-gray-500'}`}>
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </div>
                        <span className="font-bold text-base">
                            {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                        </span>
                    </div>
                    <div className={`w-12 h-7 rounded-full relative transition-colors duration-300 ${theme === 'dark' ? 'bg-green-500' : 'bg-gray-200'}`}>
                        <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${theme === 'dark' ? 'left-6' : 'left-1'}`}></div>
                    </div>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <button className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center justify-between text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <span className="font-medium">Ayuda y Soporte</span>
                        <ChevronRight size={20} className="text-gray-400" />
                    </button>
                    <button className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center justify-between text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <span className="font-medium">Historial Recargas</span>
                        <ChevronRight size={20} className="text-gray-400" />
                    </button>
                </div>

                <button 
                    onClick={handleLogout}
                    className="w-full bg-red-50 dark:bg-red-900/10 p-5 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-center justify-center gap-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors mt-4 font-bold"
                >
                    <LogOut size={20} />
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </div>
    );

    // --- Main Layout ---
    return (
        <div className="min-h-screen w-full bg-[#f3f4f6] dark:bg-gray-950 transition-colors duration-300 flex flex-col font-sans">
            
            {/* Top Header - Responsive */}
            {user && (
                <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30 transition-colors supports-[backdrop-filter]:bg-white/60">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 md:h-20 flex justify-between items-center">
                        {/* Logo & School Info */}
                        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveScreen('HOME')}>
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white flex items-center justify-center p-1 shadow-sm border border-gray-100 group-hover:scale-105 transition-transform">
                                <img 
                                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Logo_de_la_Universidad_de_Colima.svg/640px-Logo_de_la_Universidad_de_Colima.svg.png" 
                                    alt="UCol Logo" 
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <div className="hidden sm:flex flex-col">
                                <h1 className="text-lg md:text-xl font-bold text-gray-800 dark:text-white leading-tight tracking-tight">Aperativo</h1>
                                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 gap-1">
                                    <MapPin className="w-3 h-3" />
                                    <span>{user.school}</span>
                                </div>
                            </div>
                            {/* Mobile Title (visible when no logo text) */}
                            <div className="sm:hidden flex flex-col">
                                <span className="text-xs text-gray-400">Hola,</span>
                                <span className="font-bold text-gray-800 dark:text-white leading-tight">{user.name.split(' ')[0]}</span>
                            </div>
                        </div>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-1 bg-gray-100/50 dark:bg-gray-800/50 p-1.5 rounded-full border border-gray-200 dark:border-gray-700">
                            {[
                                { id: 'HOME', icon: Home, label: 'Inicio' },
                                { id: 'MENU', icon: MenuIcon, label: 'Menú' },
                                { id: 'ORDERS', icon: Bell, label: 'Pedidos' },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveScreen(item.id as Screen)}
                                    className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold transition-all ${
                                        activeScreen === item.id 
                                        ? 'bg-white dark:bg-gray-700 text-green-700 dark:text-green-400 shadow-sm scale-105' 
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                                    }`}
                                >
                                    <item.icon size={16} strokeWidth={2.5} />
                                    {item.label}
                                </button>
                            ))}
                        </nav>

                        {/* Right Actions */}
                        <div className="flex items-center gap-3 sm:gap-4">
                            {/* Balance */}
                            <div 
                                onClick={() => setActiveScreen('PROFILE')}
                                className="flex bg-green-50 dark:bg-green-900/20 px-3 py-1.5 md:px-4 md:py-2 rounded-xl items-center gap-2 border border-green-100 dark:border-green-800/50 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                            >
                                <Coins size={16} className="text-green-600 dark:text-green-400 sm:w-[18px] sm:h-[18px]" />
                                <span className="text-sm md:text-base font-bold text-green-800 dark:text-green-300">{user.balance.toFixed(0)}</span>
                            </div>

                            {/* Cart */}
                            <button 
                                onClick={() => setIsCartOpen(true)} 
                                className="relative p-2.5 md:p-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-xl transition-all group active:scale-95"
                            >
                                <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
                                {cartItems.length > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 text-[10px] flex items-center justify-center text-white font-bold animate-pulse">
                                        {cartItems.length}
                                    </span>
                                )}
                            </button>

                            {/* Profile (Desktop) */}
                            <button 
                                onClick={() => setActiveScreen('PROFILE')} 
                                className="hidden md:flex w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-green-500 to-emerald-700 rounded-xl items-center justify-center text-white font-bold shadow-md hover:scale-105 transition-transform"
                            >
                                {user.name.charAt(0)}
                            </button>
                        </div>
                    </div>
                </header>
            )}

            {/* Main Content Area */}
            <main className={`flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 ${activeScreen === 'ADMIN_PANEL' ? '' : 'pb-24 md:pb-8'}`}>
                {activeScreen === 'HOME' && <HomeScreen />}
                {activeScreen === 'MENU' && <MenuScreen />}
                {activeScreen === 'ORDERS' && <OrdersScreen />}
                {activeScreen === 'PROFILE' && <ProfileScreen />}
                {activeScreen === 'ADMIN_PANEL' && <AdminScreen />}
            </main>

            {/* Mobile Bottom Navigation */}
            {user && (
                <nav className="md:hidden bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-100 dark:border-gray-800 px-6 py-3 flex justify-between items-center fixed bottom-0 w-full z-30 transition-colors pb-safe safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    <button 
                        onClick={() => setActiveScreen('HOME')}
                        className={`flex flex-col items-center gap-1 transition ${activeScreen === 'HOME' ? 'text-green-700 dark:text-green-400 scale-105' : 'text-gray-400 dark:text-gray-500'}`}
                    >
                        <Home className="w-6 h-6" strokeWidth={activeScreen === 'HOME' ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">Inicio</span>
                    </button>
                    <button 
                        onClick={() => setActiveScreen('MENU')}
                        className={`flex flex-col items-center gap-1 transition ${activeScreen === 'MENU' ? 'text-green-700 dark:text-green-400 scale-105' : 'text-gray-400 dark:text-gray-500'}`}
                    >
                        <MenuIcon className="w-6 h-6" strokeWidth={activeScreen === 'MENU' ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">Menú</span>
                    </button>
                    
                    <button 
                        onClick={() => setActiveScreen('ORDERS')}
                        className={`flex flex-col items-center gap-1 transition ${activeScreen === 'ORDERS' ? 'text-green-700 dark:text-green-400 scale-105' : 'text-gray-400 dark:text-gray-500'}`}
                    >
                        <Bell className="w-6 h-6" strokeWidth={activeScreen === 'ORDERS' ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">Pedidos</span>
                    </button>
                    <button 
                        onClick={() => setActiveScreen('PROFILE')}
                        className={`flex flex-col items-center gap-1 transition ${activeScreen === 'PROFILE' ? 'text-green-700 dark:text-green-400 scale-105' : 'text-gray-400 dark:text-gray-500'}`}
                    >
                        <UserIcon className="w-6 h-6" strokeWidth={activeScreen === 'PROFILE' ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">Perfil</span>
                    </button>
                </nav>
            )}

            {/* Components Overlay */}
            <Cart 
                isOpen={isCartOpen} 
                onClose={() => setIsCartOpen(false)} 
                items={cartItems} 
                loyaltyPoints={user?.loyaltyPoints || 0}
                onUpdateQuantity={updateQuantity}
                onCheckout={handleCheckout}
            />
            
            <AIAssistant />
            <RechargeModal />

        </div>
    );
};
export default App;