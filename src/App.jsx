import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuth } from './auth/useAuth';
import ProtectedRoute from './auth/ProtectedRoute';
import { useSession } from './session/useSession';
import Login from './pages/Login';
import StartSession from './pages/StartSession';
import Capture from './pages/Capture';
import ItemResult from './pages/ItemResult';
import SeizureMemoReview from './pages/SeizureMemoReview';
import ConsolidatedReport from './pages/ConsolidatedReport';
import DashboardHome from './pages/DashboardHome';
import FilterDrilldown from './pages/FilterDrilldown';
import Search from './pages/Search';
import ReportViewer from './pages/ReportViewer';
import OfficerActivity from './pages/OfficerActivity';

export default function App() {
  const { isLoggedIn, role, login, logout } = useAuth();
  const { session, startSession, addItem, endSession } = useSession();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login login={login} />} />

        <Route path="/session" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}><StartSession startSession={startSession} /></ProtectedRoute>
        } />
        <Route path="/capture" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}><Capture addItem={addItem} /></ProtectedRoute>
        } />
        <Route path="/item-result" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}><ItemResult /></ProtectedRoute>
        } />
        <Route path="/seizure-memo" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}><SeizureMemoReview /></ProtectedRoute>
        } />
        <Route path="/consolidated-report" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}><ConsolidatedReport /></ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}><DashboardHome /></ProtectedRoute>
        } />
        <Route path="/dashboard/filter" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}><FilterDrilldown /></ProtectedRoute>
        } />
        <Route path="/dashboard/search" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}><Search /></ProtectedRoute>
        } />
        <Route path="/dashboard/report/:id" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}><ReportViewer /></ProtectedRoute>
        } />
        <Route path="/dashboard/officer" element={
          <ProtectedRoute isLoggedIn={isLoggedIn}><OfficerActivity /></ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}