import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MerchantLayout } from './MerchantLayout.js';
import { Dashboard } from './Dashboard.js';
import { SettingsRoute } from './RoutedPages.js';
import { Login } from './Login.js';
import { ProductsPage } from './ProductsPage.js';
import { CategoriesPage } from './CategoriesPage.js';
import { CustomersPage } from './CustomersPage.js';
import { MediaPage } from './MediaPage.js';
import { DiscountsPage } from './DiscountsPage.js';
import { BranchesPage } from './BranchesPage.js';
import { ProductBuilderPage } from './ProductBuilderPage.js';
import { OrdersPage } from './OrdersPage.js';
import { DesignSystem } from './DesignSystem.js';

export const router = createBrowserRouter([
  {
    path: '/design-system',
    element: <DesignSystem />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <MerchantLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'dashboard', element: <Navigate to="/" replace /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/new', element: <ProductBuilderPage /> },
      { path: 'products/:id/edit', element: <ProductBuilderPage /> },
      { path: 'products/create', element: <ProductBuilderPage /> },
      { path: 'products/builder', element: <ProductBuilderPage /> },
      { path: 'product-builder', element: <ProductBuilderPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'media', element: <MediaPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'discounts', element: <DiscountsPage /> },
      { path: 'branches', element: <BranchesPage /> },
      { path: 'settings', element: <SettingsRoute /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
