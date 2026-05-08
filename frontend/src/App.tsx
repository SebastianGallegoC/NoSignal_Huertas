import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "@/components/routing/ProtectedRoute";
import { ReloadPrompt } from "@/components/ReloadPrompt";

const LoginPage = lazy(() =>
  import("@/pages/LoginPage").then((mod) => ({ default: mod.LoginPage })),
);
const InicioPage = lazy(() =>
  import("@/pages/InicioPage").then((mod) => ({ default: mod.InicioPage })),
);
const FormularioPage = lazy(() =>
  import("@/pages/FormularioPage").then((mod) => ({
    default: mod.FormularioPage,
  })),
);
const FormulariosDiligenciadosPage = lazy(() =>
  import("@/pages/FormulariosDiligenciadosPage").then((mod) => ({
    default: mod.FormulariosDiligenciadosPage,
  })),
);
const ImportarFormulariosPage = lazy(() =>
  import("@/pages/ImportarFormulariosPage").then((mod) => ({
    default: mod.ImportarFormulariosPage,
  })),
);

function App() {
  return (
    <>
      <Suspense fallback={<div className="p-4 text-sm text-slate-600">Cargando…</div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/inicio"
            element={
              <ProtectedRoute>
                <InicioPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/formulario"
            element={
              <ProtectedRoute>
                <FormularioPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/formularios-diligenciados"
            element={
              <ProtectedRoute>
                <FormulariosDiligenciadosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/importar-formularios"
            element={
              <ProtectedRoute>
                <ImportarFormulariosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/formularios"
            element={
              <ProtectedRoute>
                <Navigate to="/formularios-diligenciados" replace />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/inicio" replace />} />
          <Route path="*" element={<Navigate to="/inicio" replace />} />
        </Routes>
      </Suspense>
      <ReloadPrompt />
    </>
  );
}

export default App;
