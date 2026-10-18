import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Cargando } from './components/ui';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PuntoDeVenta from './pages/PuntoDeVenta';
import Ventas from './pages/Ventas';
import Caja from './pages/Caja';
import Productos from './pages/Productos';
import Inventario from './pages/Inventario';
import Compras from './pages/Compras';
import Reportes from './pages/Reportes';
import Usuarios from './pages/Usuarios';
import Configuracion from './pages/Configuracion';
import { Categorias, Clientes, Proveedores } from './pages/Catalogos';

/** Pantallas reservadas al administrador: un cajero que entra por URL vuelve al punto de venta. */
function SoloAdmin({ children }) {
  const { esAdmin } = useAuth();
  return esAdmin ? children : <Navigate to="/vender" replace />;
}

export default function App() {
  const { usuario, verificando, esAdmin } = useAuth();

  if (verificando) {
    return (
      <div className="pantalla-completa">
        <Cargando texto="Iniciando el sistema…" />
      </div>
    );
  }

  if (!usuario) return <Login />;

  const admin = (pantalla) => <SoloAdmin>{pantalla}</SoloAdmin>;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={esAdmin ? <Dashboard /> : <Navigate to="/vender" replace />} />
        <Route path="/vender" element={<PuntoDeVenta />} />
        <Route path="/ventas" element={<Ventas />} />
        <Route path="/caja" element={<Caja />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/productos" element={<Productos />} />
        <Route path="/categorias" element={admin(<Categorias />)} />
        <Route path="/inventario" element={admin(<Inventario />)} />
        <Route path="/compras" element={admin(<Compras />)} />
        <Route path="/proveedores" element={admin(<Proveedores />)} />
        <Route path="/reportes" element={admin(<Reportes />)} />
        <Route path="/usuarios" element={admin(<Usuarios />)} />
        <Route path="/configuracion" element={admin(<Configuracion />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
