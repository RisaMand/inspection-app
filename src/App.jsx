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
  const { isLoggedIn, role, userId, login, logout, authLoaded } = useAuth();
  const { session, sessionLoaded, startSession, addItem, endSession } = useSession(userId);

  return (
    <BrowserRouter>
      {isLoggedIn && authLoaded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1rem' }}>
          <SyncStatus pendingCount={session?.items?.length ?? 0} />
          <button onClick={logout}>Log Out</button>
        </div>
      )}
      <Routes>
        <Route path="/" element={<Login login={login} isLoggedIn={isLoggedIn} authLoaded={authLoaded} currentRole={role} />} />

        <Route path="/session" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded} role={role} allowedRole="inspector"><StartSession startSession={startSession} session={session} /></ProtectedRoute>
        } />
        <Route path="/capture" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded} role={role} allowedRole="inspector"><Capture addItem={addItem} session={session} sessionLoaded={sessionLoaded} /></ProtectedRoute>
        } />
        <Route path="/item-result/:id" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded} role={role} allowedRole="inspector"><ItemResult session={session} /></ProtectedRoute>
        } />
        <Route path="/seizure-memo" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded} role={role} allowedRole="inspector"><SeizureMemoReview /></ProtectedRoute>
        } />
        <Route path="/consolidated-report" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded} role={role} allowedRole="inspector"><ConsolidatedReport session={session} endSession={endSession} /></ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded} role={role} allowedRole="official"><DashboardHome /></ProtectedRoute>
        } />
        <Route path="/dashboard/filter" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded} role={role} allowedRole="official"><FilterDrilldown /></ProtectedRoute>
        } />
        <Route path="/dashboard/search" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded} role={role} allowedRole="official"><Search /></ProtectedRoute>
        } />
        <Route path="/dashboard/report/:id" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded} role={role} allowedRole="official"><ReportViewer /></ProtectedRoute>
        } />
        <Route path="/dashboard/officer" element={
          <ProtectedRoute isLoggedIn={isLoggedIn} authLoaded={authLoaded} role={role} allowedRole="official"><OfficerActivity /></ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}