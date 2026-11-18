import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MerchantLayout } from './MerchantLayout.js';
import { MerchantRouteLoading } from './components/MerchantRouteLoading.js';
import { MerchantRouteBoundary } from './components/MerchantRouteBoundary.js';

const Dashboard = lazy(() =>
  import('./Dashboard.js').then((module) => ({ default: module.Dashboard })),
);
const SettingsRoute = lazy(() =>
  import('./RoutedPages.js').then((module) => ({ default: module.SettingsRoute })),
);
const AccountPage = lazy(() =>
  import('./features/account/AccountPage.js').then((module) => ({ default: module.AccountPage })),
);
const Login = lazy(() => import('./Login.js').then((module) => ({ default: module.Login })));
const ProductsPage = lazy(() =>
  import('./ProductsPage.js').then((module) => ({ default: module.ProductsPage })),
);
const CategoriesPage = lazy(() =>
  import('./CategoriesPage.js').then((module) => ({ default: module.CategoriesPage })),
);
const CustomersPage = lazy(() =>
  import('./CustomersPage.js').then((module) => ({ default: module.CustomersPage })),
);
const MediaPage = lazy(() =>
  import('./MediaPage.js').then((module) => ({ default: module.MediaPage })),
);
const DiscountsPage = lazy(() =>
  import('./DiscountsPage.js').then((module) => ({ default: module.DiscountsPage })),
);
const BranchesPage = lazy(() =>
  import('./features/inventory/BranchesPage.js').then((module) => ({
    default: module.BranchesPage,
  })),
);
const ProductBuilderPage = lazy(() =>
  import('./features/catalog/product-builder/ProductBuilderPage.js').then((module) => ({
    default: module.ProductBuilderPage,
  })),
);
const StorefrontOrdersPage = lazy(() =>
  import('./StorefrontOrdersPage.js').then((module) => ({ default: module.StorefrontOrdersPage })),
);
const DesignSystem = lazy(() =>
  import('./DesignSystem.js').then((module) => ({ default: module.DesignSystem })),
);
const StockItemsPage = lazy(() =>
  import('./features/inventory/StockItemsPage.js').then((module) => ({
    default: module.StockItemsPage,
  })),
);
const InventoryOperationsPage = lazy(() =>
  import('./features/inventory/InventoryOperationsPage.js').then((module) => ({
    default: module.InventoryOperationsPage,
  })),
);
const InventoryStockActionPage = lazy(() =>
  import('./features/inventory/InventoryStockActionPage.js').then((module) => ({
    default: module.InventoryStockActionPage,
  })),
);
const PurchaseInvoicesPage = lazy(() =>
  import('./features/purchasing/PurchaseInvoicesPage.js').then((module) => ({
    default: module.PurchaseInvoicesPage,
  })),
);
const EmployeesPage = lazy(() =>
  import('./features/staff/EmployeesPage.js').then((module) => ({ default: module.EmployeesPage })),
);
const StaffPage = lazy(() =>
  import('./features/hr/StaffPage.js').then((module) => ({ default: module.StaffPage })),
);
const AttendancePage = lazy(() =>
  import('./features/hr/AttendancePage.js').then((module) => ({ default: module.AttendancePage })),
);
const PayrollPage = lazy(() =>
  import('./features/hr/PayrollPage.js').then((module) => ({ default: module.PayrollPage })),
);
const StaffAdvancesPage = lazy(() =>
  import('./features/hr/StaffAdvancesPage.js').then((module) => ({
    default: module.StaffAdvancesPage,
  })),
);
const ExpensesPage = lazy(() =>
  import('./features/hr/ExpensesPage.js').then((module) => ({ default: module.ExpensesPage })),
);
const CouriersPage = lazy(() =>
  import('./features/delivery/CouriersPage.js').then((module) => ({
    default: module.CouriersPage,
  })),
);
const RegistersPage = lazy(() =>
  import('./features/pos/RegistersPage.js').then((module) => ({ default: module.RegistersPage })),
);
const CashCustodyPage = lazy(() =>
  import('./features/pos/CashCustodyPage.js').then((module) => ({
    default: module.CashCustodyPage,
  })),
);
const TablesPage = lazy(() =>
  import('./features/pos/TablesPage.js').then((module) => ({ default: module.TablesPage })),
);
const ShiftReportsPage = lazy(() =>
  import('./features/pos/ShiftReportsPage.js').then((module) => ({
    default: module.ShiftReportsPage,
  })),
);
const ItemReturnReportsPage = lazy(() =>
  import('./features/pos/ItemReturnReportsPage.js').then((module) => ({
    default: module.ItemReturnReportsPage,
  })),
);
const PosOperationsReportPage = lazy(() =>
  import('./features/pos/PosOperationsReportPage.js').then((module) => ({
    default: module.PosOperationsReportPage,
  })),
);
const ProductProfitabilityPage = lazy(() =>
  import('./features/reports/ProductProfitabilityPage.js').then((module) => ({
    default: module.ProductProfitabilityPage,
  })),
);
const BusinessReportsPage = lazy(() =>
  import('./features/reports/BusinessReportsPage.js').then((module) => ({
    default: module.BusinessReportsPage,
  })),
);
const InventoryHealthPage = lazy(() =>
  import('./features/inventory/InventoryVisibilityPages.js').then((module) => ({
    default: module.InventoryHealthPage,
  })),
);
const StockItemDetailPage = lazy(() =>
  import('./features/inventory/InventoryVisibilityPages.js').then((module) => ({
    default: module.StockItemDetailPage,
  })),
);
const StockMovementDetailPage = lazy(() =>
  import('./features/inventory/InventoryVisibilityPages.js').then((module) => ({
    default: module.StockMovementDetailPage,
  })),
);

function loadOnRoute(element: ReactNode) {
  return (
    <MerchantRouteBoundary>
      <Suspense fallback={<MerchantRouteLoading />}>{element}</Suspense>
    </MerchantRouteBoundary>
  );
}

export const router = createBrowserRouter([
  {
    path: '/design-system',
    element: loadOnRoute(<DesignSystem />),
  },
  {
    path: '/login',
    element: loadOnRoute(<Login />),
  },
  {
    path: '/',
    element: <MerchantLayout />,
    children: [
      { index: true, element: loadOnRoute(<Dashboard />) },
      { path: 'reports', element: loadOnRoute(<BusinessReportsPage />) },
      { path: 'dashboard', element: <Navigate to="/" replace /> },
      { path: 'products', element: loadOnRoute(<ProductsPage />) },
      { path: 'products/new', element: loadOnRoute(<ProductBuilderPage />) },
      { path: 'products/:id/edit', element: loadOnRoute(<ProductBuilderPage />) },
      { path: 'products/create', element: loadOnRoute(<ProductBuilderPage />) },
      { path: 'products/builder', element: loadOnRoute(<ProductBuilderPage />) },
      { path: 'product-builder', element: loadOnRoute(<ProductBuilderPage />) },
      { path: 'categories', element: loadOnRoute(<CategoriesPage />) },
      { path: 'inventory', element: loadOnRoute(<InventoryOperationsPage view="overview" />) },
      { path: 'inventory/health', element: loadOnRoute(<InventoryHealthPage />) },
      { path: 'inventory/items/:itemId', element: loadOnRoute(<StockItemDetailPage />) },
      { path: 'inventory/items', element: loadOnRoute(<StockItemsPage />) },
      {
        path: 'inventory/movements/:movementId',
        element: loadOnRoute(<StockMovementDetailPage />),
      },
      {
        path: 'inventory/history',
        element: loadOnRoute(<InventoryOperationsPage view="history" />),
      },
      {
        path: 'inventory/opening',
        element: loadOnRoute(<InventoryOperationsPage view="opening" />),
      },
      {
        path: 'inventory/waste',
        element: loadOnRoute(<InventoryStockActionPage action="waste" />),
      },
      {
        path: 'inventory/transfers',
        element: loadOnRoute(<InventoryStockActionPage action="transfer" />),
      },
      {
        path: 'inventory/settings',
        element: loadOnRoute(<InventoryOperationsPage view="settings" />),
      },
      { path: 'inventory/operations', element: <Navigate to="/inventory" replace /> },
      { path: 'inventory/purchases/*', element: loadOnRoute(<PurchaseInvoicesPage />) },
      { path: 'media', element: loadOnRoute(<MediaPage />) },
      { path: 'orders', element: loadOnRoute(<StorefrontOrdersPage />) },
      { path: 'customers', element: loadOnRoute(<CustomersPage />) },
      { path: 'discounts', element: loadOnRoute(<DiscountsPage />) },
      { path: 'branches', element: loadOnRoute(<BranchesPage />) },
      { path: 'employees', element: loadOnRoute(<EmployeesPage />) },
      { path: 'staff', element: loadOnRoute(<StaffPage />) },
      { path: 'staff/attendance', element: loadOnRoute(<AttendancePage />) },
      { path: 'staff/payroll', element: loadOnRoute(<PayrollPage />) },
      { path: 'staff/advances', element: loadOnRoute(<StaffAdvancesPage />) },
      { path: 'staff/expenses', element: loadOnRoute(<ExpensesPage />) },
      { path: 'delivery-couriers', element: loadOnRoute(<CouriersPage />) },
      { path: 'pos-registers', element: loadOnRoute(<RegistersPage />) },
      { path: 'pos-cash', element: loadOnRoute(<CashCustodyPage />) },
      { path: 'pos-tables', element: loadOnRoute(<TablesPage />) },
      { path: 'pos-shift-reports', element: loadOnRoute(<ShiftReportsPage />) },
      { path: 'pos-item-returns', element: loadOnRoute(<ItemReturnReportsPage />) },
      { path: 'pos-operations', element: loadOnRoute(<PosOperationsReportPage />) },
      { path: 'profitability', element: loadOnRoute(<ProductProfitabilityPage />) },
      { path: 'settings', element: loadOnRoute(<SettingsRoute />) },
      { path: 'account', element: loadOnRoute(<AccountPage />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
