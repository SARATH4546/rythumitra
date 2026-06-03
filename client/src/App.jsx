import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import Farmers from './pages/Farmers'
import Prices from './pages/Prices'
import Schemes from './pages/Schemes'
import Alerts from './pages/Alerts'
import Analytics from './pages/Analytics'
import IVRSimulator from './pages/IVRSimulator'
import WhatsAppBot from './pages/WhatsAppBot'
import { ToastProvider } from './components/Toast'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Sidebar />
          <div className="main-content">
            <Header />
            <div className="page-body">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard"  element={<Dashboard />} />
                <Route path="/farmers"    element={<Farmers />} />
                <Route path="/prices"     element={<Prices />} />
                <Route path="/schemes"    element={<Schemes />} />
                <Route path="/alerts"     element={<Alerts />} />
                <Route path="/analytics"  element={<Analytics />} />
                <Route path="/ivr"        element={<IVRSimulator />} />
                <Route path="/whatsapp"   element={<WhatsAppBot />} />
              </Routes>
            </div>
          </div>
        </div>
      </BrowserRouter>
    </ToastProvider>
  )
}
