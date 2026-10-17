import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Login } from './Login.js';
import { POSLayout } from './POSLayout.js';
import { POSScreen } from './POSScreen.js';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <POSLayout />,
    children: [{ index: true, element: <POSScreen /> }],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
