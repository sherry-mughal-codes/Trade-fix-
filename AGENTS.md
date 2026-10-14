# Development and Bug Fixing Rules

## 1. Inspect the Existing Project Before Coding
- Always inspect the existing codebase, folder structure, architecture, database models, APIs, services, components, validations, permissions, and UI patterns before making any changes.
- Understand how the existing feature works and identify its dependencies before implementing a new feature or fixing a bug.
- Determine whether the request is a bug fix, an architecture correction, a configuration change, or a new feature.
- Identify reusable components and existing functionality before writing new code.
- Never assume a feature, model, API, field, or component is missing without verifying it in the codebase.
- If the existing implementation is incomplete or incorrect, identify the root cause before making changes.

## 2. Implement in Controlled Phases
- Divide large tasks into clear, manageable phases or levels.
- Implement only the phase explicitly requested by me.
- Complete each phase independently, verify it, and report the results before proceeding to another phase.
- Do not implement future phases, additional features, or unrelated improvements without my approval.
- Clearly identify what will change before making significant modifications.
- If an important requirement is ambiguous, ask me before making an assumption that could affect architecture, data, accounting, or business logic.

## 3. Preserve Existing Code and Functionality
- Never unnecessarily overwrite, regenerate, delete, or rewrite existing working code.
- Prefer minimal, targeted changes over large refactoring.
- Preserve existing modules, features, workflows, APIs, user permissions, database records, and integrations.
- Do not redesign unrelated screens or change existing behavior outside the requested scope.
- Fix the underlying cause of a problem instead of applying temporary workarounds.
- Preserve backward compatibility wherever reasonably possible.
- Never remove existing functionality simply because a new implementation would be easier.

## 4. Reuse the Existing Architecture
- Reuse existing models, database relationships, services, APIs, validation functions, helpers, utilities, permissions, notification mechanisms, UI components, and business logic.
- Follow the project's established coding conventions and architectural patterns.
- Before creating a new model, table, API, service, component, or utility, verify that an existing one cannot fulfill the requirement.
- Extend existing functionality when appropriate instead of creating parallel implementations.
- Use existing application frameworks and native features before introducing custom solutions.
- Avoid unnecessary dependencies, libraries, packages, and architectural complexity.

## 5. Maintain One Source of Truth
- Every business entity, financial transaction, inventory movement, status, and calculation must have a clearly defined authoritative source.
- Never create duplicate records, redundant tables, parallel APIs, or multiple versions of the same business logic without a genuine requirement.
- Reuse existing authoritative records and relationships.
- Do not store information that can reliably be derived from existing authoritative data unless there is a justified architectural reason.
- Avoid duplicated calculations across the frontend and backend. Keep authoritative business calculations in the appropriate backend service or business layer.
- Ensure related screens, reports, ledgers, and summaries remain consistent with the same underlying records.
- Do not introduce conflicting lifecycle or status fields when an existing authoritative workflow or state field already serves that purpose.

## 6. No Hardcoded Business Values
- Do not hardcode business rules, commission percentages, thresholds, tax rates, prices, payment limits, designations, hierarchy depths, naming formats, or other values that should be configurable.
- Store configurable business rules in appropriate settings, master records, or existing configuration mechanisms.
- Use existing system settings rather than introducing duplicate configuration screens.
- Distinguish genuinely fixed technical constants from business values that users or administrators may need to change.
- Do not invent business rules that I have not approved.
- Configuration must actually affect application behavior; never add settings that do nothing.

## 7. Protect Database and Existing Data
- Preserve all existing customers, products, sales, invoices, inventory, purchases, returns, payments, commissions, accounting records, and other business data.
- Never clear, reset, or recreate the production database to implement a feature.
- Use safe, reversible database migrations where practical.
- Consider existing records, nullable fields, default values, unique constraints, foreign keys, and data compatibility before changing the schema.
- Preserve relationships and historical transaction records.
- Use transactions and appropriate rollback handling for operations that update multiple related records.
- Prevent duplicate submissions, duplicate financial postings, invalid stock movements, and inconsistent accounting entries.
- Never silently delete historical data or alter completed financial transactions.
- Test migrations against existing data whenever possible.

## 8. Follow the Existing UI and Design System
- All new screens, forms, dialogs, tables, cards, buttons, icons, and reports must look and behave like native parts of the existing application.
- Reuse existing typography, font sizes, colors, spacing, borders, field dimensions, button styles, table layouts, card dimensions, and responsive behavior.
- Maintain visual symmetry, alignment, consistency, and professional appearance.
- Do not introduce a separate design language or unnecessarily redesign existing screens.
- Do not add decorative elements, redundant descriptions, excessive headings, or unnecessary visual components.
- Use meaningful headings only. Do not add explanatory text underneath headings unless it provides genuine value.
- Preserve existing print-slip and document formatting conventions.

## 9. Keep the User Experience Simple and Efficient
- Design for fast, practical daily business operations.
- Minimize unnecessary clicks, repeated data entry, and manual calculations.
- Autofill, retrieve, or calculate values when reliable existing data is available.
- Use progressive disclosure or collapsible optional sections when it improves usability.
- Keep nonessential fields optional unless a business or technical requirement makes them mandatory.
- Avoid overwhelming users with unnecessary information, controls, cards, or filters.
- Keep system-generated or operational values read-only when users should not edit them directly.
- Make forms, tables, and workflows straightforward for nontechnical business users.

## 10. Fields, Search, Filters, and Lists
- Add only fields that are genuinely required for the feature.
- Reuse existing fields instead of creating duplicates with similar meanings.
- Make relevant fields searchable using the application's established search patterns.
- Ensure useful list views, search behavior, filters, sorting, and status indicators work correctly.
- Add only filters that materially help users find or manage records.
- Avoid duplicate search boxes and redundant filters.
- Make identifiers, relationships, and historical records easy to find where relevant.
- Ensure search and filtering work with real data, not just sample records.

## 11. Buttons, Icons, and Actions
- Every visible button, icon, menu item, and action must perform its intended function.
- Never add dummy buttons, decorative action icons, placeholder functionality, or dead code.
- Follow the application's existing conventions for action buttons and icon placement.
- Use action icons with hover tooltips that clearly explain their purpose.
- Implement proper loading states, validation feedback, success messages, and error messages using existing mechanisms.
- Prevent repeated clicks from causing duplicate operations where relevant.
- Respect existing role-based permissions and prevent unauthorized actions.
- Verify each new action through actual interaction, not merely by confirming that the button appears.

## 12. Maintain Business Logic and Accounting Accuracy
- Understand the complete business workflow before changing calculations or transaction handling.
- Reuse existing accounting, inventory, payment, commission, sales, purchasing, and return mechanisms.
- Ensure stock increases and decreases at the correct stage of the workflow.
- Ensure financial transactions affect the correct accounts and are posted only at the appropriate stage.
- Prevent duplicate ledger entries and incorrect balances.
- Keep pending, approved, settled, and paid states distinct wherever the business workflow requires them.
- Ensure cancellations, returns, replacements, and reversals correctly update related records.
- Preserve historical reporting and ledger accuracy.
- Never assume that changing a screen or status alone correctly updates the underlying accounting or inventory records.

## 13. Forms, Validation, and Notifications
- Reuse existing validation rules, notification components, and error-handling mechanisms.
- Validate required fields, data types, relationships, unique identifiers, and business constraints at the appropriate backend and frontend levels.
- Provide clear, user-friendly error messages that explain what is wrong and how to correct it.
- Validate data as early as practical when immediate feedback improves usability, such as detecting duplicate identifiers during entry.
- Do not rely exclusively on frontend validation for critical business rules or data integrity.
- Ensure invalid operations are rejected safely and do not leave partial or inconsistent records.

## 14. Permissions and Security
- Reuse the existing authentication, roles, and permission architecture.
- Ensure read, create, edit, delete, approve, and payment permissions are enforced at the appropriate levels.
- Do not bypass backend authorization simply because a UI control is hidden or disabled.
- Protect sensitive business and financial operations.
- Avoid exposing credentials, secrets, or sensitive data in code, logs, or error messages.
- Ensure optional modules and restricted features respect the application's existing permission and visibility settings.

## 15. Print Slips, Invoices, and Reports
- Reuse existing printing services, templates, formatting conventions, and report-generation mechanisms.
- Keep all new slips, invoices, and printed documents consistent with existing professional output.
- Match existing fonts, font sizes, spacing, alignment, page dimensions, and information hierarchy.
- Include only relevant information and avoid unnecessary decorative elements.
- Verify that printed output is readable and correctly formatted, not just that the print button works.
- Ensure totals, dates, identifiers, and financial amounts match the underlying authoritative records.

## 16. Number Cards and Dashboard Statistics
- Do not automatically add number cards or summary statistics to every new screen.
- Decide whether cards are genuinely useful for the specific workflow and whether they improve decision-making.
- Add them only when justified by the user's needs and the screen's purpose.
- If cards are appropriate, reuse existing card styles, dimensions, typography, and spacing.
- Preserve symmetry and avoid overcrowding the interface.
- Do not add cards simply to make a screen look more sophisticated.

## 17. Testing and Verification
- Test the actual functionality, not just whether the code compiles or the interface renders.
- Run relevant existing tests and add or update tests for the changed behavior.
- Verify the complete end-to-end workflow, including related records, permissions, database updates, calculations, and reports.
- Test important edge cases, invalid inputs, duplicate submissions, empty states, and failure scenarios.
- Verify that existing features still work after the changes.
- Check for regressions in connected modules and shared components.
- Verify database migrations and data preservation where applicable.
- Do not claim a feature is complete or tested unless the corresponding verification was actually performed.
- If testing is blocked by the environment, clearly state what could not be verified.

## 18. Code Quality and Maintainability
- Write clean, readable, modular code that follows existing project conventions.
- Avoid unnecessary abstraction, overengineering, repeated logic, unused code, and unnecessary comments.
- Handle errors properly instead of hiding failures.
- Keep frontend and backend responsibilities clear.
- Avoid unnecessary changes to dependencies, environment configuration, deployment procedures, and build settings.
- Consider performance, scalability, and maintainability without expanding the task beyond its approved scope.

## 19. Development Workflow and Reporting
Before implementation:
1. Inspect the existing project and related features.
2. Explain the current implementation and identify what is missing or incorrect.
3. Confirm the requested scope and identify the files, models, APIs, and components likely to be affected.
4. Identify data-integrity, compatibility, and regression risks.
5. Propose a phased implementation plan when the task is substantial.

During implementation:
1. Follow the approved plan and change only what is necessary.
2. Reuse existing components and business logic.
3. Preserve existing data and unrelated functionality.
4. Avoid unapproved scope expansion.
5. Keep changes consistent with the project's architecture and design.

After implementation:
1. Summarize exactly what was changed.
2. List any database migrations, configuration changes, or dependencies introduced.
3. Report tests and end-to-end checks actually performed.
4. Identify any known limitations or unresolved issues.
5. Confirm whether existing data and related workflows were verified.
6. Stop at the end of the requested phase and wait for my approval before starting the next phase.

## 20. Final Decision Rule
When choosing between a new implementation and an existing solution, prioritize:

1. Correctness and data integrity.
2. Reuse of existing architecture and functionality.
3. Preservation of existing working features.
4. Consistency with existing UI and UX.
5. Simplicity and efficiency for users.
6. Maintainability and scalability.
7. Minimal, controlled changes.

**Golden rule:** Inspect first. Understand before changing. Reuse before creating. Preserve before replacing. Implement only the approved scope. Test before declaring completion. Never sacrifice data integrity or existing functionality for implementation convenience.
