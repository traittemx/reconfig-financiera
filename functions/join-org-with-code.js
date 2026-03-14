import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { createClient } from 'https://esm.sh/@insforge/sdk@1.1.5';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function memberDocumentId(orgId, userId) {
    // Simple hash implementation for ID generation
    // In Edge we can just use a unique random ID or similar, but to match existing logic:
    // We will just let the DB generate one or use a random UUID if needed.
    // For now, let's just use a random UUID v4 if we can, or just a string composition.
    // The original code used sha256 slice.
    return crypto.randomUUID();
}

export default async function (req) {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('INSFORGE_URL') ?? '',
            Deno.env.get('INSFORGE_SERVICE_ROLE_KEY') ?? '', // Needs Service Role to manage users/orgs freely
        );

        // Get user from the auth header passed by the client
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: corsHeaders });
        }

        // Validate user
        const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Invalid user' }), { status: 401, headers: corsHeaders });
        }
        const userId = user.id;

        const { p_code, p_full_name } = await req.json();

        if (!p_code) {
            return new Response(JSON.stringify({ error: 'CODE_INVALID:Código de vinculación inválido' }), { status: 400, headers: corsHeaders });
        }

        // 1. Find Org
        const { data: orgDoc, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('linking_code', p_code)
            .single();

        if (orgError || !orgDoc) {
            return new Response(JSON.stringify({ error: 'CODE_INVALID:Código de vinculación inválido' }), { status: 400, headers: corsHeaders });
        }
        const orgId = orgDoc.id;

        // 2. Check Subscription / Seats
        let { data: subDoc, error: subError } = await supabase
            .from('org_subscriptions')
            .select('*')
            .eq('id', orgId)
            .single();

        if (subError) {
            // Try creating if missing (legacy logic)
            const subData = {
                id: orgId,
                status: 'trial',
                seats_total: 10,
                seats_used: 0,
                updated_at: new Date().toISOString()
            };
            const { data: newSub } = await supabase.from('org_subscriptions').insert(subData).select().single();
            subDoc = newSub;
        }

        if ((subDoc.seats_used || 0) >= (subDoc.seats_total || 10)) {
            return new Response(JSON.stringify({ error: 'NO_SEATS:No hay plazas disponibles en esta empresa' }), { status: 400, headers: corsHeaders });
        }

        // 3. Check/Add Member
        const { data: existingMember } = await supabase
            .from('org_members')
            .select('*')
            .eq('org_id', orgId)
            .eq('user_id', userId)
            .single();

        if (existingMember) {
            await supabase.from('org_members').update({
                status: 'active',
                role_in_org: 'EMPLOYEE'
            }).eq('id', existingMember.id);
        } else {
            await supabase.from('org_members').insert({
                org_id: orgId,
                user_id: userId,
                role_in_org: 'EMPLOYEE',
                status: 'active'
            });
        }

        // 4. Update Profile
        const { error: profileError } = await supabase.from('profiles').update({
            org_id: orgId,
            role: 'EMPLOYEE',
            full_name: p_full_name || undefined,
            updated_at: new Date().toISOString()
        }).eq('id', userId);

        if (profileError) {
            // Create if missing
            await supabase.from('profiles').insert({
                id: userId,
                org_id: orgId,
                full_name: p_full_name || '',
                role: 'EMPLOYEE',
                start_date: new Date().toISOString(),
            });
        }

        // 5. Update Seat Count
        const { count } = await supabase.from('org_members').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active');

        const updatedAt = new Date().toISOString();
        await supabase.from('org_subscriptions').update({
            seats_used: count,
            updated_at: updatedAt
        }).eq('id', orgId);

        // 6. Return Data
        const { data: finalSub } = await supabase.from('org_subscriptions').select('*').eq('id', orgId).single();

        return new Response(JSON.stringify({
            org_id: orgId,
            status: finalSub.status || 'trial',
            seats_total: finalSub.seats_total,
            seats_used: finalSub.seats_used,
            period_start: finalSub.period_start,
            period_end: finalSub.period_end,
            updated_at: finalSub.updated_at
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
}
