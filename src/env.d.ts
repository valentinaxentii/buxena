/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    staffUser?: import('@supabase/supabase-js').User | null;
  }
}
