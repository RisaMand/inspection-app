import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/session" element={<StartSession />} />
        <Route path="/capture" element={<Capture />} />
        <Route path="/item-result" element={<ItemResult />} />
        <Route path="/seizure-memo" element={<SeizureMemoReview />} />
        <Route path="/consolidated-report" element={<ConsolidatedReport />} />
        <Route path="/dashboard" element={<DashboardHome />} />
        <Route path="/dashboard/filter" element={<FilterDrilldown />} />
        <Route path="/dashboard/search" element={<Search />} />
        <Route path="/dashboard/report/:id" element={<ReportViewer />} />
        <Route path="/dashboard/officer" element={<OfficerActivity />} />
      </Routes>
    </BrowserRouter>
  );
}