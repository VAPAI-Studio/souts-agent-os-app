'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const redirectParam = (formData.get('redirect') as string) || '/agentos';

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // Only allow same-origin redirects to /agentos/* — defense in depth against open-redirect.
  const safeRedirect = redirectParam.startsWith('/agentos') ? redirectParam : '/agentos';
  redirect(safeRedirect);
}
