import axios from "axios";
import {
  ApiResponse,
  PaymentIntentDetailsDTO,
  VirtualAccountDetailsDTO,
  VirtualAccountTopUpDTO,
} from "../models/payment";

const apiUrl = import.meta.env.VITE_TANTE_PAY_API_URL || "http://localhost:8085";

export const apiClient = axios.create({
  baseURL: `${apiUrl}/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

function handleResponse<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new Error(response.message ?? "Payment request failed");
  }
  return response.data;
}

export const paymentApi = {
  getIntent: async (serviceReferenceNumber: string) => {
    const res = await apiClient.get<ApiResponse<PaymentIntentDetailsDTO>>(
      `/payments/intents/${encodeURIComponent(serviceReferenceNumber)}`,
    );
    return handleResponse(res.data);
  },

  getVirtualAccount: async (userAccountId: number) => {
    const res = await apiClient.get<ApiResponse<VirtualAccountDetailsDTO>>(
      `/virtual-accounts/${userAccountId}`,
    );
    return handleResponse(res.data);
  },

  createVirtualAccount: async (userAccountId: number) => {
    const res = await apiClient.post<ApiResponse<VirtualAccountDetailsDTO>>(
      `/virtual-accounts/${userAccountId}`,
    );
    return handleResponse(res.data);
  },

  topUpVirtualAccount: async (userAccountId: number, request: VirtualAccountTopUpDTO) => {
    const res = await apiClient.post<ApiResponse<VirtualAccountDetailsDTO>>(
      `/virtual-accounts/${userAccountId}/top-up`,
      request,
    );
    return handleResponse(res.data);
  },

  payWithVirtualAccount: async (serviceReferenceNumber: string) => {
    const res = await apiClient.post<ApiResponse<PaymentIntentDetailsDTO>>(
      `/payments/intents/${encodeURIComponent(serviceReferenceNumber)}/pay/virtual-account`,
    );
    return handleResponse(res.data);
  },
};
