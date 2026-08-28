import SyncStatus from './sync/SyncStatus';
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
  const { isLoggedIn, role, login, logout, authLoaded } = useAuth();
  const { session, startSession, addItem, endSession } = useSession();

  return (
    <BrowserRouter>
      <SyncStatus pendingCount={session?.items?.length ?? 0} />
      <Routes>
        <Route path="/" element={<Login login={login} />} />

        <Route path="/session" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded}><StartSession startSession={startSession} /></ProtectedRoute>
        } />
        <Route path="/capture" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded}><Capture addItem={addItem} /></ProtectedRoute>
        } />
        <Route path="/item-result/:id" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded}><ItemResult session={session} /></ProtectedRoute>
        } />
        <Route path="/seizure-memo" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded}><SeizureMemoReview /></ProtectedRoute>
        } />
        <Route path="/consolidated-report" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded}><ConsolidatedReport session={session} /></ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded}><DashboardHome /></ProtectedRoute>
        } />
        <Route path="/dashboard/filter" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded}><FilterDrilldown /></ProtectedRoute>
        } />
        <Route path="/dashboard/search" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded}><Search /></ProtectedRoute>
        } />
        <Route path="/dashboard/report/:id" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded}><ReportViewer /></ProtectedRoute>
        } />
        <Route path="/dashboard/officer" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded}><OfficerActivity /></ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}