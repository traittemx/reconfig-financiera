# Appwrite schema for Reconfiguración Financiera

Create one database with ID: `finaria` (or update `DATABASE_ID` in `lib/appwrite.ts`).

**Migración automática:** desde la raíz del proyecto, con `.env` configurado (`APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`), ejecuta:

```bash
# Crear todas las colecciones y el bucket de storage
npm run appwrite:setup

# O individualmente:
npm run appwrite:create-collections  # Solo colecciones
npm run appwrite:create-bucket        # Solo bucket de storage
```

Estos scripts crean la base de datos, todas las colecciones con sus atributos, y el bucket de Storage para audios de lecciones. Si prefieres hacerlo a mano, para cada colección siguiente créala en la consola de Appwrite (o vía API) y añade los atributos indicados. Appwrite types: string, integer, float, boolean, datetime, url. Use string for enums (e.g. role values), for text, and for optional JSON (store stringified). Use integer for counts and small numbers; float for monetary amounts and percentages.

## Collections and attributes

### organizations
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| name | string | yes | |
| slug | string | yes | Unique index |
| linking_code | string | no | Unique index where not null |
| created_at | datetime | yes | Default: now |

### profiles
Document ID = Appwrite user ID (so one document per user).  
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| full_name | string | no | |
| org_id | string | no | Reference to organizations.$id |
| role | string | yes | SUPER_ADMIN, ORG_ADMIN, EMPLOYEE |
| start_date | string | no | ISO date |
| avatar_url | string | no | URL |
| created_at | datetime | yes | |
| updated_at | datetime | yes | |

### org_members
Document ID = unique ID. Index: (org_id, user_id) unique.  
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| org_id | string | yes | |
| user_id | string | yes | Appwrite user ID |
| role_in_org | string | yes | ORG_ADMIN, EMPLOYEE |
| status | string | yes | active, disabled |
| created_at | datetime | yes | |

### org_subscriptions
Document ID = org_id (one subscription per org).  
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| status | string | yes | trial, active, past_due, canceled |
| seats_total | integer | yes | Default 10 |
| seats_used | integer | yes | Default 0 |
| period_start | string | no | ISO date |
| period_end | string | no | ISO date |
| updated_at | datetime | yes | |

### org_invites
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| org_id | string | yes | |
| email | string | yes | |
| role | string | yes | ORG_ADMIN, EMPLOYEE |
| token | string | yes | Unique index |
| expires_at | datetime | yes | |
| accepted_at | datetime | no | |
| created_at | datetime | yes | |

### lessons
Document ID = day (string "1".."23").  
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| title | string | yes | |
| summary | string | no | |
| mission | string | no | |
| audio_url | string | no | URL |

### user_lesson_progress
Document ID = unique ID. Index: (user_id, day) unique.  
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| user_id | string | yes | |
| day | string | yes | "1".."23" |
| org_id | string | yes | |
| unlocked_at | datetime | no | |
| completed_at | datetime | no | |
| notes | string | no | |

### accounts
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| user_id | string | yes | |
| org_id | string | yes | |
| name | string | yes | |
| type | string | yes | CASH, BANK, CARD, SAVINGS, INVESTMENT, CREDIT, CREDIT_CARD |
| currency | string | yes | Default MXN |
| opening_balance | float | yes | Default 0 |
| cut_off_day | integer | no | 1-31 |
| payment_day | integer | no | 1-31 |
| credit_limit | float | no | |
| created_at | datetime | yes | |

### income_sources
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| user_id | string | yes | |
| org_id | string | yes | |
| name | string | yes | |
| kind | string | no | |
| active | boolean | yes | Default true |
| created_at | datetime | yes | |

### categories
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| org_id | string | yes | |
| user_id | string | no | |
| kind | string | yes | INCOME, EXPENSE, TRANSFER |
| name | string | yes | |
| parent_id | string | no | |
| is_default | boolean | yes | Default false |
| icon | string | no | |
| color | string | no | |
| created_at | datetime | yes | |

### transactions
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| org_id | string | yes | |
| user_id | string | yes | |
| account_id | string | yes | |
| kind | string | yes | INCOME, EXPENSE, TRANSFER |
| amount | float | yes | |
| occurred_at | datetime | yes | |
| category_id | string | no | |
| note | string | no | |
| transfer_account_id | string | no | |
| is_recurring | boolean | yes | Default false |
| recurrence_period | string | no | |
| recurrence_day_of_month | integer | no | 1-31 |
| recurrence_interval_months | integer | yes | Default 1 |
| recurrence_total_occurrences | integer | no | |
| expense_label | string | no | DESEO, LUJO, NECESIDAD |
| created_at | datetime | yes | |

### budgets
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| org_id | string | yes | |
| user_id | string | yes | |
| month | string | yes | YYYY-MM |
| name | string | yes | |
| created_at | datetime | yes | |

### budget_items
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| budget_id | string | yes | |
| category_id | string | yes | |
| limit_amount | float | yes | |
| created_at | datetime | yes | |

### points_rules
Document ID = key (e.g. CREATE_EXPENSE).  
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| points | integer | yes | |
| is_active | boolean | yes | Default true |

### points_events
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| org_id | string | yes | |
| user_id | string | yes | |
| event_key | string | yes | |
| points | integer | yes | |
| ref_table | string | no | |
| ref_id | string | no | |
| created_at | datetime | yes | |

### points_totals
Document ID = composite e.g. `{org_id}_{user_id}`. Index: (org_id, user_id) unique.  
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| org_id | string | yes | |
| user_id | string | yes | |
| total_points | integer | yes | Default 0 |
| updated_at | datetime | yes | |

### savings_goals
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| account_id | string | yes | Unique |
| target_amount | float | yes | |
| name | string | no | |
| target_date | string | no | ISO date |
| created_at | datetime | yes | |
| updated_at | datetime | yes | |

### physical_assets
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| user_id | string | yes | |
| org_id | string | yes | |
| name | string | yes | |
| amount | float | yes | |
| created_at | datetime | yes | |

### pilot_daily_recommendations
Index: (user_id, recommendation_date) unique.  
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| user_id | string | yes | |
| org_id | string | yes | |
| recommendation_date | string | yes | ISO date |
| state | string | yes | SAFE, CAUTION, CONTAINMENT, REWARD |
| message_main | string | yes | |
| message_why | string | yes | |
| suggested_limit | string | yes | |
| suggested_action | string | no | |
| flexibility | string | no | bajo, medio, alto |
| signals_snapshot | string | no | JSON stringified |
| created_at | datetime | yes | |

### pilot_emotional_checkins
Index: (user_id, checkin_date) unique.  
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| user_id | string | yes | |
| checkin_date | string | yes | ISO date |
| value | string | yes | |
| created_at | datetime | yes | |

### org_pilot_aggregates
Index: (org_id, period) unique.  
| Key | Type | Required | Notes |
|-----|------|----------|-------|
| org_id | string | yes | |
| period | string | yes | e.g. YYYY-MM |
| total_users_with_recommendation | integer | yes | Default 0 |
| total_recommendations | integer | yes | Default 0 |
| count_safe | integer | yes | Default 0 |
| count_caution | integer | yes | Default 0 |
| count_containment | integer | yes | Default 0 |
| count_reward | integer | yes | Default 0 |
| pct_safe | float | no | |
| pct_caution | float | no | |
| pct_containment | float | no | |
| pct_reward | float | no | |
| follow_count | integer | yes | Default 0 |
| containment_count_for_follow | integer | yes | Default 0 |
| avg_follow_rate | float | no | |
| updated_at | datetime | yes | |

## Storage bucket

- **Bucket ID**: `lesson-audio`
- **Public**: yes (for reading lesson audio URLs)
- **Allowed MIME**: audio/mpeg, audio/mp3, audio/wav, audio/ogg, audio/aac, audio/m4a
- **Creación**: Ejecuta `npm run appwrite:create-bucket` o créalo manualmente desde la consola de Appwrite

## Permissions

Configure collection permissions in Appwrite to mirror RLS:

- **profiles**: read/write for user on own document (documentId = userId); read for org_admin on org profiles.
- **organizations**: super_admin all; org_admin read/update own org (org_id = my_org_id).
- **org_members**, **org_subscriptions**: org_admin read/update for own org; user read own membership.
- **org_invites**: org_admin all for own org; anon read by token for invite flow.
- **lessons**: read for authenticated.
- **user_lesson_progress**: user all on own; org_admin read org.
- **accounts**, **income_sources**, **categories**, **transactions**, **budgets**, **budget_items**, **savings_goals**, **physical_assets**: user all on own (user_id); super_admin all.
- **points_rules**: read authenticated; super_admin write.
- **points_events**, **points_totals**: insert/update only via Functions; read by user/org_admin as per RLS.

Where “super_admin” or “org_admin” cannot be expressed with simple role/user permissions, enforce in Appwrite Functions and call them from the client.
