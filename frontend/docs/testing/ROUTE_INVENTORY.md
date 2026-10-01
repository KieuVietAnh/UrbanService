# Route Inventory

This document lists all routes discovered in `apps/web/src/routes/AppRoutes.jsx` and role-based sidebar definitions.

| Route | Role(s) | Screen Name | Protected |
| --- | --- | --- | --- |
| / | public / service-user | Landing Page / Service User Dashboard | Unprotected for public, Protected for authenticated non-citizen users |
| /login | public | Login Page | Unprotected |
| /register | public | Register Page | Unprotected |
| /verify-email | authenticated | Verify Email Page | Protected |
| /about | public | About Page | Unprotected |
| /community/feed | public / authenticated | Community Feed Page | Public if unauthenticated, Protected if authenticated |
| /community/feed/:id | public / authenticated | Community Feedback Detail Page | Public if unauthenticated, Protected if authenticated |
| /community/map | public / authenticated | Community Map Page | Public if unauthenticated, Protected if authenticated |
| /notifications | all authenticated roles | Notification Center Page | Protected |
| /profile | all authenticated roles | Profile Page | Protected |
| /settings | all authenticated roles | Settings Page | Protected |
| /dashboard | service-staff / interaction-manager / administrator / service-provider | Dashboard Page | Protected |
| /tickets | all authenticated roles | Ticket List Page | Protected |
| /tickets/create | service-user | Create Ticket Page | Protected, Service User only |
| /tickets/:id | all authenticated roles | Ticket Detail Page | Protected |
| /tickets/:feedbackId/result | service-user | Resolution Result Page | Protected, Service User only |
| /tickets/:feedbackId/rework | service-user | Rework Center Page | Protected, Service User only |
| /tickets/archive | service-user | Closed Feedback Archive Page | Protected, Service User only |
| /staff/queue | system-staff | AI Review Queue Page | Protected, System Staff only |
| /staff/feedbacks | system-staff | Feedback List Page | Protected, System Staff only |
| /staff/feedbacks/:feedbackId | system-staff | Feedback Detail Page | Protected, System Staff only |
| /staff/assignment-history | system-staff | Assignment History Page | Protected, System Staff only |
| /staff/conversations | system-staff | Conversation Queue Page | Protected, System Staff only |
| /staff/feedbacks/:feedbackId/request-info | system-staff | Request Info Workspace Page | Protected, System Staff only |
| /staff/feedbacks/:feedbackId/history | system-staff | Assignment History Page | Protected, System Staff only |
| /staff/area-alerts | system-staff | Area Alert Management Page | Protected, System Staff only |
| /staff/provider-reports/:providerReportId | system-staff | Provider Report Workspace Page | Protected, System Staff only |
| /staff/duplicates | system-staff | Duplicate Detection Page | Protected, System Staff only |
| /staff/duplicates/:duplicateCandidateId | system-staff | Duplicate Detail Page | Protected, System Staff only |
| /staff/coordinators | system-staff / interaction-manager / administrator | Coordinator Directory Page | Protected |
| /staff/provider-candidates-checker | system-staff / interaction-manager / administrator | Provider Candidate Checker Page | Protected |
| /staff/coordinators/:coordinatorId | system-staff / interaction-manager / administrator | Coordinator Detail Page | Protected |
| /tickets/assign/:id | system-staff | Ticket Assignment Page | Protected, System Staff only |
| /provider/tasks | service-provider | Provider Tasks Page | Protected, Service Provider only |
| /manager/interactions | interaction-manager | Interaction History Monitoring Page | Protected, Interaction Manager only |
| /manager/interactions/:feedbackId | interaction-manager / administrator | Interaction Approval Detail Page | Protected |
| /manager/approvals | interaction-manager / administrator | Interaction Approval Inbox Page | Protected |
| /manager/approvals/:feedbackId | interaction-manager / administrator | Interaction Approval Detail Page | Protected |
| /analytics/sla | interaction-manager / administrator | SLA Analytics Page | Protected |
| /analytics/sentiment | interaction-manager / administrator | Sentiment Dashboard Page | Protected |
| /analytics/heatmap | interaction-manager / administrator | Heatmap Dashboard Page | Protected |
| /management/users | administrator | User Management Page | Protected, Administrator only |
| /management/feedbacks | administrator | Feedback Management Page | Protected, Administrator only |
| /management/categories | administrator | Category Management Page | Protected, Administrator only |
| /management/sla | administrator | SLA Configuration Page | Protected, Administrator only |
| /management/integrations | administrator | Integration Settings Page | Protected, Administrator only |
| /admin/audit | administrator | Audit Log Page | Protected, Administrator only |
| /admin/performance | administrator | Performance Dashboard Page | Protected, Administrator only |
