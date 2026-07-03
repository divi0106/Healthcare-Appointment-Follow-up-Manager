import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = {
  PATIENT: [
    { to: '/patient', label: 'My appointments' },
    { to: '/patient/find-doctor', label: 'Find a doctor' },
  ],
  DOCTOR: [
    { to: '/doctor', label: "Today's queue" },
    { to: '/doctor/all', label: 'All appointments' },
  ],
  ADMIN: [
    { to: '/admin/doctors', label: 'Doctors' },
    { to: '/admin/leave', label: 'Leave management' },
  ],
};

const ROLE_LABEL = {
  PATIENT: 'Patient portal',
  DOCTOR: 'Doctor portal',
  ADMIN: 'Admin console',
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV[user?.role] || [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Wellpoint Clinic</div>
        <span className="role-tag">{ROLE_LABEL[user?.role]}</span>
        <nav>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="logout" onClick={() => { logout(); navigate('/login'); }}>
          Sign out
        </button>
      </aside>
      <div className="main">
        <header className="topbar">
          <strong>{ROLE_LABEL[user?.role]}</strong>
          <span className="user">{user?.name}</span>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}