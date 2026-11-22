import { ConfigProvider } from "antd";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import routes from "./routes";

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#0F766E",
          colorInfo: "#0F766E",
          colorText: "#0F172A",
          colorTextSecondary: "#64748B",
          colorBorder: "#E2E8F0",
          colorBgLayout: "#F8FAFC",
          borderRadius: 8,
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          {routes.map(({ path, Component }) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
