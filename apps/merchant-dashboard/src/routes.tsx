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
import { BranchesPage } from './features/inventory/BranchesPage.js';
import { ProductBuilderPage } from './features/catalog/product-builder/ProductBuilderPage.js';
import { StorefrontOrdersPage } from './StorefrontOrdersPage.js';
import { DesignSystem } from './DesignSystem.js';
import { StockItemsPage } from './features/inventory/StockItemsPage.js';
import { InventoryOperationsPage } from './features/inventory/InventoryOperationsPage.js';
import { PurchaseInvoicesPage } from './features/purchasing/PurchaseInvoicesPage.js';
import { EmployeesPage } from './features/staff/EmployeesPage.js';
import { RegistersPage } from './features/pos/RegistersPage.js';
import { TablesPage } from './features/pos/TablesPage.js';

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
      { path: 'inventory', element: <InventoryOperationsPage view="overview" /> },
      { path: 'inventory/items', element: <StockItemsPage /> },
      { path: 'inventory/history', element: <InventoryOperationsPage view="history" /> },
      { path: 'inventory/opening', element: <InventoryOperationsPage view="opening" /> },
      { path: 'inventory/settings', element: <InventoryOperationsPage view="settings" /> },
      { path: 'inventory/operations', element: <Navigate to="/inventory" replace /> },
      { path: 'inventory/purchases', element: <PurchaseInvoicesPage /> },
      { path: 'media', element: <MediaPage /> },
      { path: 'orders', element: <StorefrontOrdersPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'discounts', element: <DiscountsPage /> },
      { path: 'branches', element: <BranchesPage /> },
      { path: 'employees', element: <EmployeesPage /> },
      { path: 'pos-registers', element: <RegistersPage /> },
      { path: 'pos-tables', element: <TablesPage /> },
      { path: 'settings', element: <SettingsRoute /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
