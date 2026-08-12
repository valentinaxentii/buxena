/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    staffUser?: import('@supabase/supabase-js').User | null;
    /** The signed-in staff member's role, or null when unknown. */
    staffRole?: string | null;
    /**
     * Whether the role lookup actually completed. `false` means "we could not
     * establish a role" and must be treated as unauthorised — never as staff.
     * Undefined means no lookup has run for this request yet.
     */
    staffRoleResolved?: boolean;
  }
}
