# 📋 Integration de la Gestion des Réclamations dans Smart Parking

## 📌 Vue d'ensemble

La système de gestion des réclamations (compliant management) a été intégré dans le backend Smart Parking avec des relations appropriées vers les modèles existants.

## 🗄️ Modèles de Base de Données

### Complaint Model
Fichier: `src/models/Complaint.js`

```
Complaint
├── title (String, requis)
├── description (String, requis)
├── category (enum: technical_issue, reservation_problem, payment_problem, parking_problem, application_bug, employee_issue, service_issue, other)
├── priority (enum: low, medium, high, urgent)
├── status (enum: pending, in_progress, resolved, rejected)
│
├── 🔗 Références utilisateurs:
│   ├── submittedBy → User (client ou employee)
│   ├── submittedByType (enum: client, employee)
│   └── assignedTo → User (admin, nullable)
│
├── 🔗 Références métier:
│   ├── parkingId → Parking (nullable)
│   ├── reservationId → Reservation (nullable)
│   └── spotId → ParkingSpot (nullable)
│
├── Gestion des réponses:
│   ├── response (String - notes admin)
│   ├── resolvedAt (Date)
│   ├── resolutionRating (1-5)
│   └── resolutionFeedback (String)
│
├── Autres:
│   ├── attachments (Array)
│   ├── createdAt (Date auto)
│   └── updatedAt (Date auto)
```

### Relations (Joints/Joins)

1. **Complaint → User (submittedBy)**
   - Un utilisateur (client ou employé) peut soumettre plusieurs réclamations
   - La réclamation doit avoir un auteur

2. **Complaint → User (assignedTo)**
   - Un admin peut être assigné plusieurs réclamations
   - Une réclamation n'a qu'un seul admin assigné

3. **Complaint → Parking**
   - Une réclamation peut concerner un parking spécifique
   - Un parking peut avoir plusieurs réclamations

4. **Complaint → Reservation**
   - Une réclamation peut concerner une réservation
   - Une réservation peut avoir plusieurs réclamations (rare)

5. **Complaint → ParkingSpot**
   - Une réclamation peut concerner une place spécifique
   - Une place peut avoir plusieurs réclamations

## 🔑 Endpoints API

### Base URL
```
/api/complaints
```

### Authentification
Tous les endpoints requièrent l'authentification (JWT token)

### Endpoints

#### 1. Créer une réclamation
```http
POST /api/complaints
Content-Type: application/json
Authorization: Bearer {token}

{
  "title": "Titre de la réclamation",
  "description": "Description détaillée du problème...",
  "category": "parking_problem",
  "priority": "high",
  "parkingId": "63f7d8c2e1c5a2b9c8d9e0f1",
  "reservationId": "63f7d8c2e1c5a2b9c8d9e0f2",
  "spotId": "63f7d8c2e1c5a2b9c8d9e0f3",
  "attachments": ["url/to/evidence.jpg"]
}
```

**Réponse (201):**
```json
{
  "success": true,
  "message": "Réclamation créée avec succès",
  "data": {
    "_id": "...",
    "title": "...",
    "status": "pending",
    "submittedBy": {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### 2. Récupérer toutes les réclamations
```http
GET /api/complaints?status=pending&priority=high&category=parking_problem&sortBy=-createdAt
Authorization: Bearer {token}
```

**Paramètres de requête:**
- `status` - pending, in_progress, resolved, rejected
- `priority` - low, medium, high, urgent
- `category` - voir énumération
- `submittedByType` - client, employee
- `parkingId` - ID du parking
- `sortBy` - champ de tri (defaut: -createdAt)

**Détail d'autorisation:**
- Clients voient SEULEMENT leurs propres réclamations
- Admins voient TOUTES les réclamations

#### 3. Récupérer une réclamation par ID
```http
GET /api/complaints/:id
Authorization: Bearer {token}
```

#### 4. Réclamations d'un utilisateur
```http
GET /api/complaints/user/:userId
Authorization: Bearer {token}
```

**Autorisation:**
- Utilisateurs peuvent voir SEULEMENT leurs propres réclamations
- Admins peuvent voir n'importe quel utilisateur

#### 5. Réclamations d'un parking
```http
GET /api/complaints/parking/:parkingId
Authorization: Bearer {token}
```

#### 6. Mettre à jour le statut (Admin uniquement)
```http
PUT /api/complaints/:id/status
Content-Type: application/json
Authorization: Bearer {token}

{
  "status": "in_progress",
  "response": "Nous examinons votre réclamation...",
  "assignedTo": "63f7d8c2e1c5a2b9c8d9e0f4"
}
```

**Statuts valides:**
- `pending` - Nouvelle réclamation
- `in_progress` - En cours de traitement
- `resolved` - Résolue
- `rejected` - Rejetée

#### 7. Ajouter un feedback de résolution
```http
PUT /api/complaints/:id/feedback
Content-Type: application/json
Authorization: Bearer {token}

{
  "resolutionRating": 4,
  "resolutionFeedback": "Le problème a été résolu rapidement et efficacement."
}
```

**Note:** Seulement possible sur les réclamations avec `status: resolved`

#### 8. Supprimer une réclamation
```http
DELETE /api/complaints/:id
Authorization: Bearer {token}
```

**Restrictions:**
- Clients peuvent supprimer SEULEMENT leurs propres réclamations (non résolues)
- Admins peuvent supprimer n'importe quelle réclamation (non résolue)
- Les réclamations résolues ne peuvent PAS être supprimées

#### 9. Statistiques des réclamations (Admin uniquement)
```http
GET /api/complaints/stats/overview
Authorization: Bearer {token}
```

**Réponse:**
```json
{
  "success": true,
  "data": {
    "byStatus": [
      { "_id": "pending", "count": 12 },
      { "_id": "in_progress", "count": 5 },
      { "_id": "resolved", "count": 23 }
    ],
    "byCategory": [...],
    "byPriority": [...],
    "total": [{ "count": 40 }],
    "averageResolutionTime": [...]
  }
}
```

## 🔧 Service: ComplaintService

Fichier: `src/services/ComplaintService.js`

### Méthodes disponibles

```javascript
const ComplaintService = require('../services/ComplaintService');

// Statistiques globales
ComplaintService.getStatistics(filters)

// Métriques du dashboard
ComplaintService.getDashboardMetrics()

// Réclamations d'un parking
ComplaintService.getParkingComplaints(parkingId)

// Auto-assignation intelligente
ComplaintService.autoAssignToAdmin(parkingId)

// Notifications
ComplaintService.notifyStatusChange(complaint, newStatus)

// Validation
ComplaintService.validateComplaintData(data)

// Réclamations prioritaires non assignées
ComplaintService.getUnassignedPrioritComplaints()

// Plage de dates
ComplaintService.getComplaintsByDateRange(startDate, endDate)

// Archivage ancien
ComplaintService.archiveOldComplaints(daysOld)

// Résumé utilisateur
ComplaintService.getUserComplaintSummary(userId)
```

## 🌐 Routes Configuration

Fichier: `src/routes/complaints.js`

Les routes utilisent le middleware `authMiddleware` pour vérifier l'authentification.

```javascript
const authMiddleware = require('../middleware/auth');

// Toutes les routes requièrent authMiddleware
```

## 📊 Cas d'usage courants

### 1. Client soumet une réclamation de parking
```javascript
POST /api/complaints
{
  "title": "Places de parking mal marquées",
  "description": "Les marquages au sol sont complètement effacés...",
  "category": "parking_problem",
  "priority": "medium",
  "parkingId": "xxxxx"
}
```

### 2. Client soumet une réclamation de réservation
```javascript
POST /api/complaints
{
  "title": "Problème de paiement",
  "description": "J'ai été débité deux fois...",
  "category": "payment_problem",
  "priority": "high",
  "reservationId": "xxxxx"
}
```

### 3. Admin traite une réclamation
```javascript
PUT /api/complaints/{id}/status
{
  "status": "in_progress",
  "response": "Nous enquêtons sur cette affaire.",
  "assignedTo": "admin_user_id"
}

// Puis, après résolution:
PUT /api/complaints/{id}/status
{
  "status": "resolved",
  "response": "Le problème a été corrigé. Nous avons repeint les marquages."
}
```

### 4. Client évalue la résolution
```javascript
PUT /api/complaints/{id}/feedback
{
  "resolutionRating": 5,
  "resolutionFeedback": "Excellent travail! Les marquages sont parfaits maintenant."
}
```

### 5. Admin consulte les statistiques
```javascript
GET /api/complaints/stats/overview

Response:
{
  "success": true,
  "data": {
    "byStatus": [
      { "_id": "pending", "count": 8 },
      { "_id": "resolved", "count": 45 }
    ],
    "averageRating": [{ "avgRating": 4.2 }]
  }
}
```

## 🔐 Règles de sécurité/Autorisation

1. **Création (POST):**
   - ✅ Tous utilisateurs authentifiés
   - Auto-détection du type (client/employee)

2. **Lecture (GET):**
   - ✅ Clients: voient SEULEMENT leurs propres
   - ✅ Admins: voient TOUTES

3. **Mise à jour statut (PUT /status):**
   - 🔒 ADMIN ONLY

4. **Feedback (PUT /feedback):**
   - ✅ Auteur seulement
   - Seulement sur status=resolved

5. **Suppression (DELETE):**
   - ✅ Auteur (propres réclamations non résolues)
   - ✅ Admins (n'importe quelle non résolue)
   - 🔒 Réclamations résolues: non supprimables

## 🗺️ Structure des fichiers

```
backend/src/
├── models/
│   └── Complaint.js          # Schéma MongoDB
├── controllers/
│   └── complaintController.js # Logique des endpoints
├── routes/
│   └── complaints.js         # Définition des routes
├── services/
│   └── ComplaintService.js   # Logique métier
```

## 📝 Notes importantes

1. **Soft Delete:** Les réclamations résolues ne sont pas supprimées pour raison d'audit
2. **Indexation:** Indexes créés pour optimiser les requêtes fréquentes
3. **Virtuals:** Calculs auto du `ageInDays`
4. **Middleware:** Auto-set de `resolvedAt` quand status→resolved
5. **Population:** Toutes les références sont populées pour les réponses

## 🚀 Prochaines améliorations possibles

1. Système de notification (email/SMS) quand statut change
2. Intégration avec service d'archivage pour ancien comptaits
3. Export en PDF/CSV pour les rapports admin
4. Webhook pour notifications externes
5. Rate limiting des soumissions
6. File d'attente (queue) pour traitement asynchrone
7. Système de tags/labels pour organisation
8. Discussion/commentaires sur les réclamations

## ✅ Checklist d'intégration

- [x] Modèle Complaint créé avec références
- [x] Controller avec CRUD + autorisations
- [x] Routes avec authentification
- [x] Service pour logique métier
- [x] Intégration dans server.js
- [x] Documentation
- [ ] Tests unitaires
- [ ] Tests d'intégration
- [ ] Frontend UI (Angular)
- [ ] Notifications email/SMS

---

**Dernière mise à jour:** 2024-01-15
