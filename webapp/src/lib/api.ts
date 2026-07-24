export const API_BASE = import.meta.env.DEV ? "" : "http://127.0.0.1:10756";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
  } catch (e) {
    throw new Error("Failed to connect to backend");
  }

  const contentType = res.headers.get("content-type");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Invalid response format (non-JSON). The backend may be offline or starting up");
  }

  return res.json() as Promise<T>;
}

export interface RateLimitConfig {
  messages_per_minute?: number;
  messages_per_channel_per_minute?: number;
  channels_per_minute?: number;
  invites_per_minute?: number;
  max_message_length?: number;
  min_message_interval_seconds?: number;
}

export interface SamplingStatus {
  server_side_llm_ready?: boolean;
  sampling_base_url?: string;
  sampling_model?: string;
  has_api_key?: boolean;
}

export interface Health {
  status: string;
  service?: string;
  version?: string;
  uptime_seconds?: number;
  started_at?: string;
  token_set?: boolean;
  rate_limit?: RateLimitConfig;
  sampling?: SamplingStatus;
  sampling_use_client_llm_preferred?: boolean;
  mcp_http_path?: string;
  timestamp?: string;
}

export interface Meta {
  service?: string;
  fastmcp?: string;
  mcp_transport?: string;
  mcp_path?: string;
  tools?: string[];
  prompts?: string[];
  resources?: string[];
  skills_root?: string;
  sampling?: SamplingStatus;
}

export interface SkillEntry {
  name: string;
  preview: string;
}

export interface SkillsResponse {
  skills: SkillEntry[];
}

export interface Guild {
  id: string;
  name: string;
  owner?: boolean;
}

export interface GuildsResponse {
  success: boolean;
  guilds?: Guild[];
  count?: number;
  error?: string;
}

export interface Channel {
  id: string;
  name: string;
  type: number;
}

export interface ChannelsResponse {
  success: boolean;
  channels?: Channel[];
  count?: number;
  error?: string;
}

export interface GuildStats {
  success: boolean;
  guild_id?: string;
  name?: string;
  member_count?: number;
  online_count?: number;
  owner_id?: string;
  icon?: string;
  description?: string;
  error?: string;
}

export interface Invite {
  code: string;
  url: string;
  uses?: number;
  max_uses?: number;
  inviter?: string;
}

export interface InviteCreateResponse {
  success: boolean;
  code?: string;
  url?: string;
  channel_id?: string;
  max_age?: number;
  max_uses?: number;
  error?: string;
}

export interface InvitesResponse {
  success: boolean;
  invites?: Invite[];
  count?: number;
  error?: string;
}

export interface Member {
  user_id: string;
  username?: string;
  nick?: string | null;
  roles?: string[];
  joined_at?: string;
}

export interface MembersResponse {
  success: boolean;
  members?: Member[];
  count?: number;
  error?: string;
}

export interface MessageAttachment {
  url?: string;
  filename?: string;
}

export interface MessageEmbed {
  title?: string;
  url?: string;
  description?: string;
}

export interface ReferencedMessage {
  id?: string;
  author?: string;
  content?: string;
}

export interface Message {
  id: string;
  author: string;
  content: string;
  timestamp?: string;
  edited_timestamp?: string | null;
  attachments?: MessageAttachment[];
  embeds?: MessageEmbed[];
  referenced_message?: ReferencedMessage | null;
}

export interface MessagesResponse {
  success: boolean;
  messages?: Message[];
  count?: number;
  error?: string;
}

export interface ExportMessagesResponse {
  success: boolean;
  markdown?: string;
  count?: number;
  error?: string;
}

export interface Thread {
  id: string;
  name: string;
  type?: number;
  parent_id?: string;
  message_count?: number;
  member_count?: number;
}

export interface ThreadsResponse {
  success: boolean;
  threads?: Thread[];
  count?: number;
  error?: string;
}

export interface SendMessageResponse {
  success: boolean;
  message_id?: string;
  channel_id?: string;
  error?: string;
}

export interface RagIngestResponse {
  success: boolean;
  ingested?: number;
  error?: string;
}

export interface RagHit {
  text?: string;
  message_id?: string;
  channel_id?: string;
  guild_id?: string;
  author?: string;
  timestamp?: string;
  guild_name?: string;
  channel_name?: string;
  distance?: number;
}

export interface RagQueryResponse {
  success: boolean;
  hits?: RagHit[];
  message?: string;
  error?: string;
}

export interface AgenticResponse {
  success: boolean;
  run_id?: string;
  goal?: string;
  available_operations?: string[];
  message?: string;
  error?: string;
}

export interface ProviderInfo {
  name: string;
  type: string;
  available: boolean;
  default_url?: string;
  env_base_url?: string;
  env_model?: string;
  env_api_key?: string;
  env_flag?: string;
}

export interface ProvidersResponse {
  sampling: SamplingStatus;
  ollama_running: boolean;
  providers: ProviderInfo[];
}

export interface BanEntry {
  user_id?: string;
  username?: string;
  reason?: string;
}

export interface BansResponse {
  success: boolean;
  bans?: BanEntry[];
  count?: number;
  error?: string;
}

export interface Role {
  id: string;
  name: string;
  color?: number;
  position?: number;
  managed?: boolean;
}

export interface RolesResponse {
  success: boolean;
  roles?: Role[];
  count?: number;
  error?: string;
}

export interface Webhook {
  id: string;
  name?: string;
  channel_id?: string;
  guild_id?: string;
  token?: string;
}

export interface WebhooksResponse {
  success: boolean;
  webhooks?: Webhook[];
  count?: number;
  error?: string;
}

export interface AuditEntry {
  id?: string;
  action_type?: number;
  user_id?: string;
  target_id?: string;
  reason?: string;
  created_at?: string;
}

export interface AuditLogResponse {
  success: boolean;
  entries?: AuditEntry[];
  count?: number;
  error?: string;
}

export interface OkResponse {
  success: boolean;
  error?: string;
}

export interface CommsWatcherConfig {
  mode?: string;
  interval?: number;
  webhook_url?: string;
  channels?: { channel_id: string; guild_id?: string }[];
  auto_reply?: boolean;
  auto_reply_template?: string;
}

export interface CommsWatcherStatus {
  running: boolean;
  message?: string;
  error?: string;
  config?: CommsWatcherConfig | null;
}

export interface CommsWatcherStart {
  mode?: string;
  interval?: number;
  webhook_url?: string;
  channels: { channel_id: string; guild_id?: string }[];
  auto_reply?: boolean;
  auto_reply_template?: string;
}

export const api = {
  getHealth: () => request<Health>("/api/v1/health"),
  getMeta: () => request<Meta>("/api/v1/meta"),
  getSkills: () => request<SkillsResponse>("/api/v1/skills"),
  getGuilds: () => request<GuildsResponse>("/api/v1/guilds"),
  getChannels: (guildId: string) =>
    request<ChannelsResponse>(`/api/v1/guilds/${guildId}/channels`),
  createChannel: (guildId: string, name: string, type = 0, parentId?: string) =>
    request<ChannelsResponse>(`/api/v1/guilds/${guildId}/channels`, {
      method: "POST",
      body: JSON.stringify({ name, type, parent_id: parentId }),
    }),
  deleteChannel: (channelId: string) =>
    request<OkResponse>(`/api/v1/channels/${channelId}`, { method: "DELETE" }),
  getGuildStats: (guildId: string) =>
    request<GuildStats>(`/api/v1/guilds/${guildId}/stats`),
  getInvites: (guildId: string) =>
    request<InvitesResponse>(`/api/v1/guilds/${guildId}/invites`),
  createInvite: (channelId: string, maxAge = 86400, maxUses = 0) =>
    request<InviteCreateResponse>(`/api/v1/channels/${channelId}/invites`, {
      method: "POST",
      body: JSON.stringify({ max_age: maxAge, max_uses: maxUses }),
    }),
  getMembers: (guildId: string, limit = 100) =>
    request<MembersResponse>(
      `/api/v1/guilds/${guildId}/members?limit=${limit}`,
    ),
  getChannelMessages: (channelId: string, limit = 50) =>
    request<MessagesResponse>(
      `/api/v1/channels/${channelId}/messages?limit=${limit}`,
    ),
  exportMessagesMarkdown: (channelId: string, limit = 50) =>
    request<ExportMessagesResponse>(
      `/api/v1/channels/${channelId}/export?limit=${limit}`,
    ),
  getChannelThreads: (channelId: string) =>
    request<ThreadsResponse>(`/api/v1/channels/${channelId}/threads`),
  sendMessage: (channelId: string, content: string) =>
    request<SendMessageResponse>(`/api/v1/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  ragIngest: (body: {
    channel_id: string;
    limit?: number;
    guild_name?: string;
    channel_name?: string;
    table_name?: string;
    guild_id?: string;
  }) =>
    request<RagIngestResponse>("/api/v1/rag/ingest", {
      method: "POST",
      body: JSON.stringify({
        channel_id: body.channel_id,
        limit: body.limit ?? 50,
        guild_name: body.guild_name ?? "",
        channel_name: body.channel_name ?? "",
        table_name: body.table_name ?? "discord_messages",
        guild_id: body.guild_id ?? "",
      }),
    }),
  ragQuery: (body: {
    query_text: string;
    top_k?: number;
    table_name?: string;
  }) =>
    request<RagQueryResponse>("/api/v1/rag/query", {
      method: "POST",
      body: JSON.stringify({
        query_text: body.query_text,
        top_k: body.top_k ?? 10,
        table_name: body.table_name ?? "discord_messages",
      }),
    }),
  ragSync: (body: {
    channel_id: string;
    limit?: number;
    guild_id?: string;
    guild_name?: string;
    channel_name?: string;
  }) =>
    request<RagSyncResponse>("/api/v1/rag/sync", {
      method: "POST",
      body: JSON.stringify({
        channel_id: body.channel_id,
        limit: body.limit ?? 100,
        guild_id: body.guild_id ?? "",
        guild_name: body.guild_name ?? "",
        channel_name: body.channel_name ?? "",
      }),
    }),
  getRagStats: () =>
    request<RagStatsResponse>("/api/v1/rag/stats"),
  agentic: (goal: string) =>
    request<AgenticResponse>("/api/v1/agentic", {
      method: "POST",
      body: JSON.stringify({ goal }),
    }),
  getAgenticRun: (runId: string) =>
    request<AgenticRunResponse>(`/api/v1/agentic/runs/${runId}`),
  approveAgenticRun: (runId: string, approved: boolean) =>
    request<OkResponse>("/api/v1/agentic/approve", {
      method: "POST",
      body: JSON.stringify({ run_id: runId, approved }),
    }),
  getProviders: () => request<ProvidersResponse>("/api/v1/providers"),
  getBans: (guildId: string, limit = 100) =>
    request<BansResponse>(`/api/v1/guilds/${guildId}/bans?limit=${limit}`),
  banMember: (guildId: string, userId: string, reason = "", deleteMessageSeconds = 0) =>
    request<OkResponse>(`/api/v1/guilds/${guildId}/bans/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ reason, delete_message_seconds: deleteMessageSeconds }),
    }),
  unbanMember: (guildId: string, userId: string) =>
    request<OkResponse>(`/api/v1/guilds/${guildId}/bans/${userId}`, { method: "DELETE" }),
  kickMember: (guildId: string, userId: string, reason = "") =>
    request<OkResponse>(
      `/api/v1/guilds/${guildId}/members/${userId}/kick?reason=${encodeURIComponent(reason)}`,
      { method: "DELETE" },
    ),
  getRoles: (guildId: string) => request<RolesResponse>(`/api/v1/guilds/${guildId}/roles`),
  createRole: (guildId: string, name: string) =>
    request<OkResponse>(`/api/v1/guilds/${guildId}/roles`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  deleteRole: (guildId: string, roleId: string) =>
    request<OkResponse>(`/api/v1/guilds/${guildId}/roles/${roleId}`, { method: "DELETE" }),
  assignRole: (guildId: string, userId: string, roleId: string) =>
    request<OkResponse>(`/api/v1/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
      method: "PUT",
    }),
  removeRole: (guildId: string, userId: string, roleId: string) =>
    request<OkResponse>(`/api/v1/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
      method: "DELETE",
    }),
  getWebhooks: (channelId: string) =>
    request<WebhooksResponse>(`/api/v1/channels/${channelId}/webhooks`),
  createWebhook: (channelId: string, webhookName: string) =>
    request<OkResponse>(`/api/v1/channels/${channelId}/webhooks`, {
      method: "POST",
      body: JSON.stringify({ webhook_name: webhookName }),
    }),
  deleteWebhook: (webhookId: string) =>
    request<OkResponse>(`/api/v1/webhooks/${webhookId}`, { method: "DELETE" }),
  getAuditLog: (guildId: string, limit = 50) =>
    request<AuditLogResponse>(`/api/v1/guilds/${guildId}/audit-logs?limit=${limit}`),
  getCommsWatcherStatus: () =>
    request<CommsWatcherStatus>("/api/v1/comms/watcher/status"),
  startCommsWatcher: (body: CommsWatcherStart) =>
    request<CommsWatcherStatus>("/api/v1/comms/watcher/start", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  stopCommsWatcher: () =>
    request<CommsWatcherStatus>("/api/v1/comms/watcher/stop", { method: "POST" }),
  getIntents: () =>
    request<IntentsResponse>("/api/v1/intents"),
  saveSettings: (settings: Record<string, string>) =>
    request<OkResponse>("/api/v1/settings", {
      method: "POST",
      body: JSON.stringify({ settings }),
    }),
  getRules: () =>
    request<AutomationRule[]>("/api/v1/rules"),
  saveRules: (rules: AutomationRule[]) =>
    request<OkResponse>("/api/v1/rules", {
      method: "POST",
      body: JSON.stringify({ rules }),
    }),
  getSlackBridge: () =>
    request<SlackMapping[]>("/api/v1/slack-bridge"),
  saveSlackBridge: (mappings: SlackMapping[]) =>
    request<OkResponse>("/api/v1/slack-bridge", {
      method: "POST",
      body: JSON.stringify({ mappings }),
    }),
  getAnalyticsStats: () =>
    request<AnalyticsStatsResponse>("/api/v1/stats/analytics"),
};

export interface IntentsResponse {
  token_valid: boolean;
  error?: string;
  client_id?: string;
  username?: string;
  guilds_count?: number;
  invite_url?: string;
  intents: {
    guild_members: boolean;
    message_content: boolean;
  };
}

export interface RagSyncResponse {
  success: boolean;
  ingested: number;
  error?: string;
}

export interface RagStatsTable {
  table_name: string;
  count: number;
}

export interface RagStatsResponse {
  success: boolean;
  tables?: RagStatsTable[];
  error?: string;
}

export interface AgenticStep {
  id?: string;
  type: "thought" | "tool_call";
  name?: string;
  text?: string;
  arguments?: Record<string, any>;
  is_destructive?: boolean;
  status: "pending" | "running" | "success" | "error" | "rejected";
  result?: any;
}

export interface AgenticRunResponse {
  id: string;
  goal: string;
  status: "pending" | "running" | "blocked" | "succeeded" | "failed";
  steps: AgenticStep[];
  current_step: number;
  pending_tool_call?: AgenticStep | null;
  error?: string | null;
  message?: string | null;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  condition_type: string;
  condition_value: string;
  action_type: string;
  action_value: string;
  active: boolean;
}

export interface SlackMapping {
  id: string;
  discord_channel_id: string;
  slack_webhook_url: string;
  active: boolean;
}

export interface AnalyticsStatsResponse {
  api_calls_count: number;
  errors_count: number;
  rate_limits: number;
  avg_latency_ms: number;
  message_volume: {
    time: string;
    messages: number;
  }[];
}
