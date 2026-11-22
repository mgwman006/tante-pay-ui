export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}

export enum PaymentIntentStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  REFUNDED = "REFUNDED",
  EXPIRED = "EXPIRED",
}

export interface PaymentIntentDetailsDTO {
  id: number;
  userAccountId: number;
  service: string;
  serviceReferenceNumber: string;
  amount: number;
  currency: string;
  statusCallbackUrl: string;
  paymentLink: string;
  status: PaymentIntentStatus;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  refundedAt: string | null;
}

export interface VirtualAccountDetailsDTO {
  id: number;
  userId: number;
  balance: number;
  currency: string;
  active: boolean;
}

export interface VirtualAccountTopUpDTO {
  amount: number;
  type: "TOP_UP";
  reference: string;
  description: string;
}
