import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import Register from './pages/Register';

import PatientDashboard from './pages/patient/PatientDashboard';
import FindDoctor from './pages/patient/FindDoctor';
import SymptomForm from './pages/patient/SymptomForm';

import DoctorQueue from './pages/doctor/DoctorQueue';
import DoctorAllAppointments from './pages/doctor/DoctorAllAppointments';
import PostVisitForm from './pages/doctor/PostVisitForm';

import AdminDoctors from './pages/admin/AdminDoctors';
import AdminLeave from './pages/admin/AdminLeave';

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const home = { PATIENT: '/patient', DOCTOR: '/doctor', ADMIN: '/admin/doctors' }[user.role];
  return <Navigate to={home || '/login'} replace />;
}

function withLayout(element) {
  return <Layout>{element}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<HomeRedirect />} />

          <Route path="/patient" element={
            <ProtectedRoute roles={['PATIENT']}>{withLayout(<PatientDashboard />)}</ProtectedRoute>
          } />
          <Route path="/patient/find-doctor" element={
            <ProtectedRoute roles={['PATIENT']}>{withLayout(<FindDoctor />)}</ProtectedRoute>
          } />
          <Route path="/patient/symptom-form/:appointmentId" element={
            <ProtectedRoute roles={['PATIENT']}>{withLayout(<SymptomForm />)}</ProtectedRoute>
          } />

          <Route path="/doctor" element={
            <ProtectedRoute roles={['DOCTOR']}>{withLayout(<DoctorQueue />)}</ProtectedRoute>
          } />
          <Route path="/doctor/all" element={
            <ProtectedRoute roles={['DOCTOR']}>{withLayout(<DoctorAllAppointments />)}</ProtectedRoute>
          } />
          <Route path="/doctor/post-visit/:appointmentId" element={
            <ProtectedRoute roles={['DOCTOR']}>{withLayout(<PostVisitForm />)}</ProtectedRoute>
          } />

          <Route path="/admin/doctors" element={
            <ProtectedRoute roles={['ADMIN']}>{withLayout(<AdminDoctors />)}</ProtectedRoute>
          } />
          <Route path="/admin/leave" element={
            <ProtectedRoute roles={['ADMIN']}>{withLayout(<AdminLeave />)}</ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}