import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './AppLayout.js';
import { Businesses } from './Businesses.js';
import { Templates } from './Templates.js';
import { Plans } from './Plans.js';
import { ActivitiesModules } from './ActivitiesModules.js';
import { Login } from './Login.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Businesses /> },
      { path: 'businesses', element: <Navigate to="/" replace /> },
      { path: 'templates', element: <Templates /> },
      { path: 'plans', element: <Plans /> },
      { path: 'activities', element: <ActivitiesModules /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  { path: '/login', element: <Login /> },
]);
