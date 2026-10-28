import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';
import { AppLayout } from './AppLayout.js';

const Login = lazy(() =>
  import('./Login.js').then(({ Login: page }) => ({ default: page })),
);

const DashboardPage = lazy(() =>
  import('./features/dashboard/DashboardPage.js').then(({ DashboardPage: page }) => ({ default: page })),
);
const MerchantsPage = lazy(() =>
  import('./features/merchants/MerchantsPage.js').then(({ MerchantsPage: page }) => ({ default: page })),
);
const CreateMerchantPage = lazy(() =>
  import('./features/merchants/CreateMerchantPage.js').then(({ CreateMerchantPage: page }) => ({ default: page })),
);
const MerchantDetailsPage = lazy(() =>
  import('./features/merchants/MerchantDetailsPage.js').then(({ MerchantDetailsPage: page }) => ({ default: page })),
);
const PlansPage = lazy(() =>
  import('./features/plans/PlansPage.js').then(({ PlansPage: page }) => ({ default: page })),
);
const PlanEditorPage = lazy(() =>
  import('./features/plans/PlanEditorPage.js').then(({ PlanEditorPage: page }) => ({ default: page })),
);
const SubscriptionsPage = lazy(() =>
  import('./features/subscriptions/SubscriptionsPage.js').then(({ SubscriptionsPage: page }) => ({ default: page })),
);
const TemplatesPage = lazy(() =>
  import('./features/templates/TemplatesPage.js').then(({ TemplatesPage: page }) => ({ default: page })),
);
const TemplateDetailsPage = lazy(() =>
  import('./features/templates/TemplateDetailsPage.js').then(({ TemplateDetailsPage: page }) => ({ default: page })),
);
const ActivitiesPage = lazy(() =>
  import('./features/activities/ActivitiesPage.js').then(({ ActivitiesPage: page }) => ({ default: page })),
);
const ModulesPage = lazy(() =>
  import('./features/modules/ModulesPage.js').then(({ ModulesPage: page }) => ({ default: page })),
);

function routeElement(Page: ComponentType) {
  return (
    <Suspense
      fallback={<RouteLoading />}
    >
      <Page />
    </Suspense>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- Internal lazy-route fallback, not a module entry point.
function RouteLoading() {
  const { t } = useLocale();
  return <main className="grid min-h-48 place-content-center p-6 text-sm text-waffarly-muted" role="status">{t('Loading platform overview…')}</main>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: routeElement(DashboardPage), handle: { title: 'Platform overview' } },
      { path: 'dashboard', element: routeElement(DashboardPage), handle: { title: 'Platform overview' } },
      { path: 'merchants/new', element: routeElement(CreateMerchantPage), handle: { title: 'Create a business' } },
      { path: 'merchants', element: routeElement(MerchantsPage), handle: { title: 'Businesses' } },
      { path: 'merchants/:merchantId', element: routeElement(MerchantDetailsPage), handle: { title: 'Merchant details' } },
      { path: 'businesses', element: <Navigate to="/merchants" replace /> },
      { path: 'templates/:templateId', element: routeElement(TemplateDetailsPage), handle: { title: 'Template details' } },
      { path: 'templates', element: routeElement(TemplatesPage), handle: { title: 'The design library' } },
      { path: 'plans/new', element: routeElement(PlanEditorPage), handle: { title: 'Create plan' } },
      { path: 'plans/:planId/edit', element: routeElement(PlanEditorPage), handle: { title: 'Edit plan' } },
      { path: 'plans', element: routeElement(PlansPage), handle: { title: 'Subscription plans' } },
      { path: 'subscriptions', element: routeElement(SubscriptionsPage), handle: { title: 'Subscription management' } },
      { path: 'activities', element: routeElement(ActivitiesPage), handle: { title: 'Business activities' } },
      { path: 'modules', element: routeElement(ModulesPage), handle: { title: 'Modules and platform capabilities' } },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
  { path: '/login', element: routeElement(Login) },
]);
