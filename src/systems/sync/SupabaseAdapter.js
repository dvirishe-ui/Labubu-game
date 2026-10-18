/**
 * SupabaseAdapter.js
 * Cloud backend built on supabase-js v2.
 *
 * Auth: anonymous sign-in (enable "Anonymous sign-ins" in Supabase Auth
 * settings). The session is persisted by supabase-js, so the same auth user
 * owns the cloud save across launches. Row Level Security (see
 * supabase/schema.sql) restricts every player to their own rows.
 *
 * The client is imported lazily so builds without Supabase credentials never
 * evaluate the SDK, and the offline game boots without touching the network.
 */
export class SupabaseAdapter {
  constructor(url, anonKey) {
    this.kind = 'supabase';
    this.enabled = Boolean(url && anonKey);
    this.url = url;
    this.anonKey = anonKey;
    this.client = null;
    this.userId = null;
  }

  /** Lazily creates the Supabase client. */
  async init() {
    if (this.client) return;
    const { createClient } = await import('@supabase/supabase-js');
    this.client = createClient(this.url, this.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'labubu-supabase-auth' }
    });
  }

  /** Re-uses the persisted session or signs in anonymously. */
  async ensureAuth() {
    await this.init();
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    if (data?.session?.user) {
      this.userId = data.session.user.id;
      return this.userId;
    }
    const res = await this.client.auth.signInAnonymously();
    if (res.error) throw res.error;
    this.userId = res.data.user.id;
    return this.userId;
  }

  /** Downloads this player's cloud save, or null if none exists yet. */
  async fetchSave() {
    const { data, error } = await this.client
      .from('player_saves')
      .select('save, updated_at')
      .eq('user_id', this.userId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.save) return null;
    // Trust the column timestamp if the JSON lacks one.
    data.save.meta = data.save.meta || {};
    data.save.meta.updatedAt = data.save.meta.updatedAt || Number(data.updated_at) || 0;
    return data.save;
  }

  /** Upserts the full save document. */
  async pushSave(save) {
    const { error } = await this.client.from('player_saves').upsert(
      {
        user_id: this.userId,
        player_id: save.profile.playerId,
        save,
        updated_at: save.meta.updatedAt
      },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
  }

  /** Writes the player's best score (a DB trigger keeps the max - see schema.sql). */
  async submitScore({ displayName, score, dollId }) {
    const { error } = await this.client.from('leaderboard').upsert(
      {
        user_id: this.userId,
        display_name: displayName.slice(0, 24),
        high_score: Math.floor(score),
        doll_id: dollId,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
  }

  /** Top N global runner scores. */
  async fetchLeaderboard(limit = 50) {
    const { data, error } = await this.client
      .from('leaderboard')
      .select('user_id, display_name, high_score, doll_id')
      .order('high_score', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map((row) => ({
      name: row.display_name,
      score: row.high_score,
      doll: row.doll_id,
      isMe: row.user_id === this.userId
    }));
  }
}
