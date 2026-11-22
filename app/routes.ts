import PaymentPage from "./components/PaymentPage";

const routes = [
  {
    path: "/:serviceReferenceNumber/checkout",
    Component: PaymentPage,
  },
  {
    path: "/pay/:reference",
    Component: PaymentPage,
  },
  {
    path: "/checkout",
    Component: PaymentPage,
  },
  {
    path: "*",
    Component: PaymentPage,
  },
];

export default routes;
