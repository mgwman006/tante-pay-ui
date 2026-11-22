import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Flex,
  InputNumber,
  Modal,
  Result,
  Space,
  Spin,
  Tag,
  Typography,
  notification,
} from "antd";
import { ReloadOutlined, WalletOutlined } from "@ant-design/icons";
import {
  PaymentIntentDetailsDTO,
  PaymentIntentStatus,
  VirtualAccountDetailsDTO,
  VirtualAccountTopUpDTO,
} from "../models/payment";
import {
  createVirtualAccount,
  getPaymentIntent,
  getVirtualAccount,
  payWithVirtualAccount,
  topUpVirtualAccount,
} from "../services/paymentService";

const { Title, Text } = Typography;
const simulatedTopUpEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_SIMULATED_TOP_UP === "true";

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);

// The backend stores its LocalDateTime values in UTC without an offset.
const parseUtcDate = (value: string) =>
  new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`);

const formatDateTime = (value: string) => {
  const date = parseUtcDate(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-TZ", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
};

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

function isPaid(intent: PaymentIntentDetailsDTO) {
  // The current backend records paidAt when settling but can leave status PENDING.
  return intent.status === PaymentIntentStatus.PAID || Boolean(intent.paidAt);
}

export default function PaymentPage() {
  const { serviceReferenceNumber, reference: legacyReference } = useParams();
  const [searchParams] = useSearchParams();
  const reference = serviceReferenceNumber ?? legacyReference ?? searchParams.get("reference") ?? undefined;
  const currentReference = useRef(reference);
  currentReference.current = reference;
  const returnUrl = searchParams.get("returnUrl");
  const [notificationApi, contextHolder] = notification.useNotification();
  const [intent, setIntent] = useState<PaymentIntentDetailsDTO | null>(null);
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccountDetailsDTO | null>(null);
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number | null>(null);
  const [pendingTopUp, setPendingTopUp] = useState<VirtualAccountTopUpDTO | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  const refresh = useCallback(() => setReloadCount((count) => count + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIntent(null);
    setVirtualAccount(null);
    setAccountNotFound(false);
    setLoading(true);

    const load = async () => {
      if (!reference) {
        setLoading(false);
        return;
      }

      const loadedIntent = await getPaymentIntent(reference, notificationApi);
      if (cancelled) return;
      setIntent(loadedIntent);
      if (loadedIntent && loadedIntent.status === PaymentIntentStatus.PENDING && !isPaid(loadedIntent)) {
        const result = await getVirtualAccount(loadedIntent.userAccountId, notificationApi);
        if (cancelled) return;
        if (result.status === "available") setVirtualAccount(result.account);
        setAccountNotFound(result.status === "not_found");
      }
      if (loadedIntent) setNeedsRefresh(false);
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [reference, notificationApi, reloadCount]);

  useEffect(() => {
    setTopUpAmount(null);
    setPendingTopUp(null);
    setTopUpOpen(false);
  }, [reference]);

  const handleCreateAccount = async () => {
    if (!intent || !reference || creatingAccount) return;
    const requestedReference = reference;
    setCreatingAccount(true);
    const account = await createVirtualAccount(intent.userAccountId, notificationApi);
    if (requestedReference === currentReference.current && account) {
      setVirtualAccount(account);
      setAccountNotFound(false);
    }
    setCreatingAccount(false);
  };

  const handlePay = async () => {
    if (!reference || !intent || submitting || needsRefresh) return;
    if (parseUtcDate(intent.expiresAt).getTime() <= Date.now()) {
      notificationApi.warning({
        message: "Payment expired",
        description: "Please request a new payment from the service.",
      });
      refresh();
      return;
    }
    setSubmitting(true);
    const updated = await payWithVirtualAccount(reference, notificationApi);
    if (updated) {
      setIntent(updated);
      if (!isPaid(updated)) {
        setNeedsRefresh(true);
        notificationApi.warning({
          message: "Payment status not confirmed",
          description: "Refresh the payment status before attempting another payment.",
        });
      }
    } else {
      setNeedsRefresh(true);
    }
    setSubmitting(false);
  };

  const handleTopUp = async () => {
    if (!simulatedTopUpEnabled || !intent || !virtualAccount || !reference || toppingUp) return;
    if (parseUtcDate(intent.expiresAt).getTime() <= Date.now()) {
      notificationApi.warning({
        message: "Payment expired",
        description: "Please request a new payment from the service.",
      });
      refresh();
      return;
    }
    let request = pendingTopUp;
    if (!request) {
      if (topUpAmount === null || !Number.isFinite(topUpAmount) || topUpAmount < 0.01 || topUpAmount > 9999999999.99) {
        notificationApi.warning({ message: "Enter a valid top-up amount" });
        return;
      }
      request = {
        amount: topUpAmount,
        type: "TOP_UP",
        reference: `simulated-top-up-${crypto.randomUUID()}`,
        description: "Development-only simulated top-up; no funds collected",
      };
    }
    const requestedReference = reference;
    setPendingTopUp(request);
    setToppingUp(true);
    const account = await topUpVirtualAccount(intent.userAccountId, request, notificationApi);
    if (requestedReference === currentReference.current && account) {
      setVirtualAccount(account);
      setPendingTopUp(null);
      setTopUpAmount(null);
      setTopUpOpen(false);
      notificationApi.success({
        message: "Simulated top-up completed",
        description: "The virtual account balance was credited. No real money was collected.",
      });
    }
    setToppingUp(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc" }}>
        {contextHolder}
        <Spin size="large" tip="Loading payment details..." />
      </div>
    );
  }

  if (!reference || !intent) {
    return (
      <div style={{ minHeight: "100vh", padding: "48px 16px", background: "#f8fafc" }}>
        {contextHolder}
        <Card style={{ maxWidth: 640, margin: "0 auto", borderRadius: 12 }}>
          <Result
            status="warning"
            title={reference ? "Unable to load payment" : "Payment reference missing"}
            subTitle={reference ? "Check the payment link or try again." : "Open the checkout link provided by the service."}
            extra={reference ? <Button onClick={refresh}>Try again</Button> : undefined}
          />
        </Card>
      </div>
    );
  }

  const paid = isPaid(intent);
  const expired = intent.status === PaymentIntentStatus.EXPIRED ||
    (intent.status === PaymentIntentStatus.PENDING && !paid && parseUtcDate(intent.expiresAt).getTime() <= Date.now());
  const refunded = intent.status === PaymentIntentStatus.REFUNDED;
  const payable = intent.status === PaymentIntentStatus.PENDING && !paid && !expired;
  const sameCurrency = virtualAccount?.currency === intent.currency;
  const canPay = payable && virtualAccount?.active && sameCurrency &&
    virtualAccount.balance >= intent.amount && !needsRefresh;
  const displayStatus = refunded ? "Refunded" : paid ? "Paid" : expired ? "Expired" : formatLabel(intent.status);

  return (
    <div style={{ minHeight: "100vh", padding: "32px 16px", background: "#f8fafc" }}>
      {contextHolder}
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Card style={{ borderRadius: 12, borderColor: "#e2e8f0" }}>
            <Flex justify="space-between" align="center" wrap gap={12}>
              <div>
                <Title level={4} style={{ margin: 0 }}>Tante Pay</Title>
                <Text type="secondary">Service reference: {intent.serviceReferenceNumber}</Text>
              </div>
              <Tag color={refunded ? "default" : paid ? "green" : expired ? "default" : "gold"}>
                {displayStatus}
              </Tag>
            </Flex>
            <Descriptions column={{ xs: 1, sm: 2 }} style={{ marginTop: 20 }} size="small">
              <Descriptions.Item label="Amount">
                <Text strong>{formatAmount(intent.amount, intent.currency)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Service">{formatLabel(intent.service)}</Descriptions.Item>
              <Descriptions.Item label="Expires at">{formatDateTime(intent.expiresAt)}</Descriptions.Item>
            </Descriptions>
          </Card>

          {!payable ? (
            <Card style={{ borderRadius: 12, borderColor: "#e2e8f0" }}>
              <Result
                status={refunded ? "info" : paid ? "success" : "warning"}
                title={refunded ? "Payment refunded" : paid ? "Payment completed" : expired ? "Payment expired" : "Payment unavailable"}
                subTitle={refunded ? "This payment has been refunded." : paid
                  ? `Paid ${formatAmount(intent.amount, intent.currency)}.`
                  : expired ? "This payment link has expired. Please request a new payment from the service."
                    : `The payment cannot be settled while its status is ${displayStatus}.`}
                extra={returnUrl ? <Button type="primary" href={returnUrl}>Return to application</Button> : undefined}
              />
            </Card>
          ) : (
            <Card title="Choose how to pay" style={{ borderRadius: 12, borderColor: "#e2e8f0" }}>
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Card size="small" style={{ borderRadius: 10, borderColor: "#0F766E" }}>
                  <Space><WalletOutlined /><Text strong>Virtual account</Text></Space>
                  <div style={{ marginTop: 14 }}>
                    {virtualAccount ? (
                      <Space direction="vertical" size="small" style={{ width: "100%" }}>
                        <Flex justify="space-between" align="center" wrap gap={8}>
                          <Text type="secondary">Available balance</Text>
                          <Text strong>{formatAmount(virtualAccount.balance, virtualAccount.currency)}</Text>
                        </Flex>
                        {!virtualAccount.active && <Alert type="error" showIcon message="Virtual account is inactive" />}
                        {virtualAccount.active && !sameCurrency && (
                          <Alert type="warning" showIcon message="Virtual account currency does not match the payment currency" />
                        )}
                        {virtualAccount.active && sameCurrency && virtualAccount.balance < intent.amount && (
                          <>
                            <Alert type="warning" showIcon message="Insufficient virtual account balance"
                              description="Top up your virtual account before paying." />
                            <Button disabled={submitting || needsRefresh} onClick={() => {
                              if (!pendingTopUp) {
                                setTopUpAmount(Math.ceil((intent.amount - virtualAccount.balance) * 100) / 100);
                              }
                              setTopUpOpen(true);
                            }}>
                              Load funds
                            </Button>
                          </>
                        )}
                        <Button type="primary" loading={submitting} disabled={!canPay || toppingUp} onClick={handlePay}>
                          Pay {formatAmount(intent.amount, intent.currency)}
                        </Button>
                      </Space>
                    ) : accountNotFound ? (
                      <Space direction="vertical" size="small" style={{ width: "100%" }}>
                        <Alert type="info" showIcon message="No virtual account found"
                          description="Create a virtual account to use it for this payment." />
                        <Button type="primary" loading={creatingAccount} onClick={handleCreateAccount}>
                          Create virtual account
                        </Button>
                      </Space>
                    ) : (
                      <Alert type="warning" showIcon message="Virtual account unavailable"
                        description="Could not load your virtual account. Refresh to try again." />
                    )}
                  </div>
                </Card>
                {needsRefresh && (
                  <Alert type="warning" showIcon message="Check payment status before trying again"
                    description="The payment result could not be confirmed. Refresh the status to see whether it was completed." />
                )}
                <Alert type="info" showIcon message="Other payment methods are not currently available" />
                <Button icon={<ReloadOutlined />} disabled={submitting || creatingAccount || toppingUp} onClick={refresh}>Refresh payment details</Button>
              </Space>
              <Modal
                title="Load funds"
                open={topUpOpen}
                onCancel={() => setTopUpOpen(false)}
                closable={!toppingUp}
                maskClosable={!toppingUp}
                keyboard={!toppingUp}
                footer={simulatedTopUpEnabled ? [
                  <Button key="cancel" disabled={toppingUp} onClick={() => setTopUpOpen(false)}>Cancel</Button>,
                  <Button key="confirm" type="primary" loading={toppingUp} onClick={handleTopUp}>
                    {pendingTopUp ? "Retry simulated top-up" : "Simulate top-up"}
                  </Button>,
                ] : [
                  <Button key="close" onClick={() => setTopUpOpen(false)}>Close</Button>,
                ]}
              >
                {simulatedTopUpEnabled ? (
                  <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    <Alert type="warning" showIcon message="Development-only simulated top-up"
                      description="This directly credits the account; no real money is collected." />
                    <label htmlFor="top-up-amount">Top-up amount ({virtualAccount?.currency})</label>
                    <InputNumber id="top-up-amount" min={0.01} max={9999999999.99}
                      precision={2} value={topUpAmount} disabled={toppingUp || !!pendingTopUp}
                      onChange={setTopUpAmount} style={{ width: "100%" }} />
                    {pendingTopUp && (
                      <Alert type="warning" showIcon message="Top-up result not confirmed"
                        description="A retry uses the same transaction reference. Check the balance before retrying." />
                    )}
                  </Space>
                ) : (
                  <Alert type="info" showIcon message="Loading funds is not available"
                    description="A payment provider is needed to collect funds. You can refresh your balance after funding your account through another service." />
                )}
              </Modal>
            </Card>
          )}
        </Space>
      </div>
    </div>
  );
}
