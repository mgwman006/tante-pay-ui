import axios from "axios";
import { NotificationInstance } from "antd/es/notification/interface";
import { paymentApi } from "../api/api";
import {
  PaymentIntentDetailsDTO,
  VirtualAccountDetailsDTO,
  VirtualAccountTopUpDTO,
} from "../models/payment";

const notifyError = (
  notificationApi: NotificationInstance,
  error: unknown,
  fallbackTitle: string,
) => {
  const message = axios.isAxiosError(error)
    ? (error.response?.data as { message?: string } | undefined)?.message ?? error.message
    : error instanceof Error
      ? error.message
      : "Unexpected payment error";

  notificationApi.error({
    message: fallbackTitle,
    description: message,
  });
};

export const getPaymentIntent = async (
  serviceReferenceNumber: string,
  notificationApi: NotificationInstance,
): Promise<PaymentIntentDetailsDTO | null> => {
  try {
    return await paymentApi.getIntent(serviceReferenceNumber);
  } catch (error) {
    notifyError(notificationApi, error, "Unable to load payment details");
    return null;
  }
};

export const getVirtualAccount = async (
  userAccountId: number,
  notificationApi: NotificationInstance,
): Promise<
  | { status: "available"; account: VirtualAccountDetailsDTO }
  | { status: "not_found" }
  | { status: "error" }
> => {
  try {
    const account = await paymentApi.getVirtualAccount(userAccountId);
    return { status: "available", account };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return { status: "not_found" };
    }
    notifyError(notificationApi, error, "Unable to load virtual account");
    return { status: "error" };
  }
};

export const createVirtualAccount = async (
  userAccountId: number,
  notificationApi: NotificationInstance,
): Promise<VirtualAccountDetailsDTO | null> => {
  try {
    return await paymentApi.createVirtualAccount(userAccountId);
  } catch (error) {
    notifyError(notificationApi, error, "Unable to create virtual account");
    return null;
  }
};

export const topUpVirtualAccount = async (
  userAccountId: number,
  request: VirtualAccountTopUpDTO,
  notificationApi: NotificationInstance,
): Promise<VirtualAccountDetailsDTO | null> => {
  try {
    return await paymentApi.topUpVirtualAccount(userAccountId, request);
  } catch (error) {
    notifyError(notificationApi, error, "Unable to simulate top-up");
    return null;
  }
};

export const payWithVirtualAccount = async (
  serviceReferenceNumber: string,
  notificationApi: NotificationInstance,
): Promise<PaymentIntentDetailsDTO | null> => {
  try {
    return await paymentApi.payWithVirtualAccount(serviceReferenceNumber);
  } catch (error) {
    notifyError(notificationApi, error, "Virtual account payment failed");
    return null;
  }
};
