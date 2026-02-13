
export enum Category {
    ALL = 'Todos',
    BREAKFAST = 'Desayuno',
    LUNCH = 'Comida',
    SNACKS = 'Snacks',
    DRINKS = 'Bebidas',
    HEALTHY = 'Saludable'
}

export interface MenuItem {
    id: string;
    name: string;
    description: string;
    price: number;
    category: Category;
    image: string;
    calories?: number;
    prepTime: number; // in minutes
    isPopular?: boolean;
}

export interface CartItem extends MenuItem {
    quantity: number;
    note?: string;
}

export enum OrderStatus {
    PENDING = 'Pendiente',
    COMPLETED = 'Entregado'
}

export enum PaymentMethod {
    CASH = 'Efectivo',
    UCOL_COINS = 'Ucol Coins'
}

export enum PickupTime {
    NOW = 'Lo antes posible',
    RECESS = 'Recreo (9:30 AM)',
    CUSTOM = 'Hora Personalizada'
}

export interface Order {
    id: string;
    items: CartItem[];
    total: number;        // Final amount paid by user
    subtotal?: number;    // Total value of items before discount
    discount?: number;    // Amount discounted
    pointsEarned?: number;
    pointsRedeemed?: number;
    status: OrderStatus;
    date: string;
    pickupTime: string; // Changed to string to support custom times
    userId?: string;
    pickupCode?: string; // New field for the "Direct Pickup" code
    paymentMethod?: PaymentMethod;
}

export type Screen = 'HOME' | 'MENU' | 'CART' | 'PROFILE' | 'ORDERS' | 'ADMIN_PANEL';

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    isError?: boolean;
}

export interface User {
    name: string;
    email: string;
    school: string; // Bachillerato
    grade: string;
    group: string;
    balance: number;
    loyaltyPoints?: number; // Points accumulated for free meal
}