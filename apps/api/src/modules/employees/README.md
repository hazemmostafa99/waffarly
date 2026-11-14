# Employees

Employees owns owner-facing staff account configuration: listing, creation,
editing, role assignment and active branch assignment at `/owner/employees`.

Auth continues to own sign-in, sessions, session revocation checks, current
permissions and supervisor credential verification. Employees imports Auth's
public password, owner-guard and username-validation APIs; Auth does not import
Employees. AppModule registers both modules independently.

The service/controller class names and constructors remain unchanged for callers
and test fixtures; their files moved from Auth into this business module.
Login validation is now in Auth's `pos-login.schemas.ts`. Cross-module code must
use `auth/index.ts` rather than importing Auth's private implementation files.
