<script lang="ts">
  import { tick } from 'svelte';
  import { claimCodexResetCredit } from './backend';
  import Icon from './Icon.svelte';
  import ProviderIcon from './ProviderIcon.svelte';
  import type { ProviderViewState, QuotaWindow, ResetClaimOutcome } from './types';

  interface Props {
    state?: ProviderViewState;
    now: number;
    expanded: boolean;
    onToggle: () => void;
    onRefresh: () => void;
    onSettings: () => void;
    onClose: () => void;
    onDragStart: (event: PointerEvent) => void;
    onContentChange?: () => void;
    onClaimReset?: (expiresAt: string, redeemRequestId: string) => Promise<ResetClaimOutcome>;
  }

  let {
    state: providerState,
    now,
    expanded,
    onToggle,
    onRefresh,
    onSettings,
    onClose,
    onDragStart,
    onContentChange = () => {},
    onClaimReset = claimCodexResetCredit,
  }: Props = $props();
  const USD_TO_CNY = 6.75;
  let costExpanded = $state(false);
  let tokenDetail = $state<'today' | 'window' | null>(null);
  let costRevealTimer: ReturnType<typeof setTimeout> | undefined;
  let resetConfirming = $state(false);
  let resetPending = $state(false);
  let resetResult = $state<ResetClaimOutcome | null>(null);
  let resetRequestId = $state<string | null>(null);
  let selectedResetExpiry = $state<string | null>(null);
  const quota = $derived.by(() => {
    const quotas = providerState?.snapshot?.quotas ?? [];
    return (
      quotas.find((item) => item.id === 'weekly') ??
      [...quotas].sort((left, right) => right.periodSeconds - left.periodSeconds)[0]
    );
  });
  const sessionQuota = $derived.by(() => {
    const quotas = providerState?.snapshot?.quotas ?? [];
    return (
      quotas.find((item) => item.id === 'session') ??
      quotas.find((item) => item.periodSeconds >= 4 * 60 * 60 && item.periodSeconds <= 6 * 60 * 60)
    );
  });
  const used = $derived(Math.round(Math.min(100, Math.max(0, quota?.usedPercent ?? 0))));
  const remaining = $derived(100 - used);
  const hasData = $derived(Boolean(quota));
  const sessionUsed = $derived(
    Math.round(Math.min(100, Math.max(0, sessionQuota?.usedPercent ?? 0))),
  );
  const sessionRemaining = $derived(100 - sessionUsed);
  const hasSessionData = $derived(Boolean(sessionQuota));
  const elapsed = $derived.by(() => {
    if (!quota?.resetsAt || quota.periodSeconds <= 0) return null;
    const resetAt = Date.parse(quota.resetsAt);
    if (!Number.isFinite(resetAt)) return null;
    const startedAt = resetAt - quota.periodSeconds * 1000;
    return Math.min(1, Math.max(0, (now - startedAt) / (quota.periodSeconds * 1000)));
  });
  const reference = $derived(elapsed === null ? null : Math.round(elapsed * 100));
  const paceDelta = $derived(reference === null ? null : used - reference);
  const sessionElapsed = $derived.by(() => {
    if (!sessionQuota?.resetsAt || sessionQuota.periodSeconds <= 0) return null;
    const resetAt = Date.parse(sessionQuota.resetsAt);
    if (!Number.isFinite(resetAt)) return null;
    const startedAt = resetAt - sessionQuota.periodSeconds * 1000;
    return Math.min(1, Math.max(0, (now - startedAt) / (sessionQuota.periodSeconds * 1000)));
  });
  const sessionReference = $derived(
    sessionElapsed === null ? null : Math.round(sessionElapsed * 100),
  );
  const sessionPaceDelta = $derived(
    sessionReference === null ? null : sessionUsed - sessionReference,
  );
  const projected = $derived.by(() => {
    if (elapsed === null || elapsed < 0.05 || !hasData) return null;
    return Math.round(Math.min(999, used / elapsed));
  });
  const pace = $derived.by(() => {
    if (!hasData)
      return { label: '7 天等待数据', detail: '读取 7 天额度后生成参考', tone: 'neutral' };
    if (paceDelta === null) {
      if (used >= 85) return { label: '7 天额度告急', detail: '7 天剩余额度较少', tone: 'danger' };
      if (used >= 65)
        return { label: '7 天余量偏低', detail: '建议为后续任务预留周额度', tone: 'warning' };
      return { label: '7 天额度宽裕', detail: '7 天额度仍有充足可用空间', tone: 'good' };
    }
    if (paceDelta >= 15)
      return {
        label: '7 天用量明显偏快',
        detail: `7 天用量高于时间参考 ${paceDelta} 个百分点`,
        tone: 'danger',
      };
    if (paceDelta >= 7)
      return {
        label: '7 天用量略快',
        detail: `7 天用量高于时间参考 ${paceDelta} 个百分点`,
        tone: 'warning',
      };
    if (paceDelta <= -10)
      return {
        label: '7 天额度很宽裕',
        detail: `7 天用量低于时间参考 ${Math.abs(paceDelta)} 个百分点`,
        tone: 'good',
      };
    return { label: '7 天节奏正常', detail: '用量与 7 天时间进度基本一致', tone: 'good' };
  });
  const sessionPace = $derived.by(() => {
    if (!hasSessionData)
      return { label: '等待数据', detail: '账户暂未返回 5 小时窗口', tone: 'neutral' };
    if (sessionPaceDelta === null) {
      if (sessionUsed >= 85)
        return { label: '额度告急', detail: '5 小时剩余额度较少', tone: 'danger' };
      if (sessionUsed >= 65)
        return { label: '余量偏低', detail: '建议为当前 5 小时周期预留额度', tone: 'warning' };
      return { label: '额度宽裕', detail: '5 小时额度仍有充足可用空间', tone: 'good' };
    }
    if (sessionPaceDelta >= 15)
      return {
        label: '用量明显偏快',
        detail: `5 小时用量高于时间参考 ${sessionPaceDelta} 个百分点`,
        tone: 'danger',
      };
    if (sessionPaceDelta >= 7)
      return {
        label: '用量略快',
        detail: `5 小时用量高于时间参考 ${sessionPaceDelta} 个百分点`,
        tone: 'warning',
      };
    if (sessionPaceDelta <= -10)
      return {
        label: '额度很宽裕',
        detail: `5 小时用量低于时间参考 ${Math.abs(sessionPaceDelta)} 个百分点`,
        tone: 'good',
      };
    return { label: '节奏正常', detail: '用量与 5 小时时间进度基本一致', tone: 'good' };
  });
  const resetMetric = $derived(
    providerState?.snapshot?.valueMetrics.find((item) => item.id === 'rateLimitResets') ?? null,
  );
  const resetCount = $derived(Math.max(0, Math.floor(resetMetric?.values[0]?.number ?? 0)));
  const resetExpiry = $derived(
    [...(resetMetric?.expiriesAt ?? [])]
      .filter((value) => Number.isFinite(Date.parse(value)) && Date.parse(value) > now)
      .sort()[0] ?? null,
  );
  const resetResultMessage = $derived(
    resetResult === 'success'
      ? '重置已生效，正在同步最新额度。'
      : resetResult === 'nothingToReset'
        ? '当前没有需要重置的有效额度，本次不会消耗。'
        : resetResult === 'noCredit'
          ? '该重置额度已失效或不再可用。'
          : resetResult === 'failed'
            ? '重置未成功，请刷新后再试。'
            : null,
  );
  const reminder = $derived.by(() => {
    const rank: Record<string, number> = { neutral: 0, good: 1, warning: 2, danger: 3 };
    const weeklyRank = hasData ? rank[pace.tone] : 0;
    const sessionRank = hasSessionData ? rank[sessionPace.tone] : 0;
    const detail = [
      hasSessionData ? `5 小时：${sessionPace.label}，${sessionPace.detail}` : null,
      hasData ? `${pace.label}，${pace.detail}` : null,
    ]
      .filter(Boolean)
      .join('；');

    if (!hasData && !hasSessionData)
      return { label: '读取中', detail: '正在读取 5 小时与 7 天额度', tone: 'neutral' };
    if (weeklyRank <= 1 && sessionRank <= 1)
      return {
        label: hasData && hasSessionData ? '双周期正常' : hasSessionData ? '5小时正常' : '7天正常',
        detail,
        tone: 'good',
      };

    const useSession =
      sessionRank > weeklyRank ||
      (sessionRank === weeklyRank && hasSessionData && sessionRemaining < remaining);
    const selected = useSession ? sessionPace : pace;
    const period = useSession ? '5小时' : '7天';
    const suffix = selected.label.includes('告急')
      ? '告急'
      : selected.label.includes('余量')
        ? '余量低'
        : selected.tone === 'danger'
          ? '过快'
          : '偏快';
    return { label: `${period}${suffix}`, detail, tone: selected.tone };
  });
  const status = $derived.by(() => {
    if (providerState?.refreshing) return '正在更新';
    if (!hasData && providerState?.error) return '请登录 Codex';
    if (!hasData) return '正在读取用量';
    if (providerState?.stale || providerState?.error) return '截至目前（缓存）';
    return '截至目前';
  });
  const todayCost = $derived(providerState?.snapshot?.usage.today?.estimatedCostUsd ?? null);
  const monthCost = $derived(providerState?.snapshot?.usage.last30Days?.estimatedCostUsd ?? null);
  const accountHistoryCost = $derived(
    providerState?.snapshot?.usage.accountHistory?.estimatedCostUsd ?? null,
  );
  const todayCny = $derived(todayCost === null ? null : todayCost * USD_TO_CNY);
  const monthCny = $derived(monthCost === null ? null : monthCost * USD_TO_CNY);
  const accountHistoryCny = $derived(
    accountHistoryCost === null ? null : accountHistoryCost * USD_TO_CNY,
  );
  const todayTokenBreakdown = $derived(providerState?.snapshot?.usage.todayTokenBreakdown ?? null);
  const currentWindowTokenBreakdown = $derived(
    providerState?.snapshot?.usage.currentWindowTokenBreakdown ?? null,
  );
  const todayTokens = $derived(
    breakdownTotal(todayTokenBreakdown) ?? providerState?.snapshot?.usage.today?.tokens ?? null,
  );
  const currentWindowTokens = $derived(providerState?.snapshot?.usage.currentWindowTokens ?? null);
  const accountHistoryTokens = $derived(
    providerState?.snapshot?.usage.accountHistory?.tokens ?? null,
  );
  const exactTokenFormatter = new Intl.NumberFormat('zh-CN');

  function breakdownTotal(value: { cached: number; input: number; output: number } | null) {
    return value === null ? null : value.cached + value.input + value.output;
  }

  function formatUsd(value: number | null) {
    return value === null ? '暂无数据' : `$${value.toFixed(2)}`;
  }

  function formatCny(value: number | null) {
    return value === null ? '暂无数据' : `¥${value.toFixed(2)}`;
  }

  function formatTokens(value: number | null) {
    if (value === null) return '—';
    if (value >= 100_000_000) return `${Number((value / 100_000_000).toFixed(2))} 亿`;
    if (value >= 10_000) return `${Number((value / 10_000).toFixed(1))} 万`;
    return exactTokenFormatter.format(value);
  }

  function tokenTooltip(label: string, value: number | null) {
    return value === null
      ? `${label}：暂无本机日志数据`
      : `${label}：${exactTokenFormatter.format(value)} tokens（本机日志统计）`;
  }

  function quotaResetText(window: QuotaWindow | undefined) {
    if (!window?.resetsAt) return '重置时间待返回';
    const resetAt = Date.parse(window.resetsAt);
    if (!Number.isFinite(resetAt)) return '重置时间待返回';
    const remainingMs = resetAt - now;
    if (remainingMs <= 0) return '等待新周期';
    const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const relative =
      hours >= 24
        ? `${Math.floor(hours / 24)} 天 ${hours % 24} 小时后重置`
        : hours > 0
          ? `${hours} 小时${minutes > 0 ? ` ${minutes} 分` : ''}后重置`
          : `${minutes} 分后重置`;
    const exact = new Intl.DateTimeFormat('zh-CN', {
      ...(hours >= 24 ? { month: 'numeric' as const, day: 'numeric' as const } : {}),
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(resetAt);
    return `${relative} · ${exact}`;
  }

  function resetExpiryText(expiry: string | null) {
    if (!expiry) return resetCount > 0 ? '到期时间同步中' : '账户暂无个人重置额度';
    const date = new Date(expiry);
    return `最早一份将于 ${new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)} 到期`;
  }

  async function beginResetClaim() {
    if (resetPending || resetCount <= 0 || !resetExpiry) return;
    resetResult = null;
    if (selectedResetExpiry !== resetExpiry) resetRequestId = null;
    selectedResetExpiry = resetExpiry;
    resetRequestId ??=
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    resetConfirming = true;
    await tick();
    onContentChange();
  }

  async function confirmResetClaim() {
    if (!resetConfirming || resetPending || !selectedResetExpiry || !resetRequestId) return;
    if (Date.parse(selectedResetExpiry) <= now) {
      resetResult = 'noCredit';
      resetConfirming = false;
      return;
    }
    resetPending = true;
    let outcome: ResetClaimOutcome;
    try {
      outcome = await onClaimReset(selectedResetExpiry, resetRequestId);
    } catch {
      outcome = 'failed';
    }
    resetResult = outcome;
    resetPending = false;
    resetConfirming = false;
    if (outcome !== 'failed') resetRequestId = null;
    await tick();
    onContentChange();
  }

  async function cancelResetClaim() {
    if (resetPending) return;
    resetConfirming = false;
    await tick();
    onContentChange();
  }

  async function toggleTokenDetails(period: 'today' | 'window') {
    tokenDetail = tokenDetail === period ? null : period;
    await tick();
    onContentChange();
  }

  function revealCostDetails() {
    const detail = document.getElementById('cost-estimate-detail');
    if (!detail) return;
    const content = detail.closest<HTMLElement>('.content');
    if (content && typeof content.scrollTo === 'function') {
      content.scrollTo({
        top: Math.max(0, content.scrollHeight - content.clientHeight),
        behavior: 'smooth',
      });
      return;
    }
    if (typeof detail.scrollIntoView === 'function') {
      detail.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
  }

  async function toggleCostDetails() {
    costExpanded = !costExpanded;
    window.clearTimeout(costRevealTimer);
    await tick();
    onContentChange();
    if (!costExpanded) return;
    requestAnimationFrame(() => requestAnimationFrame(revealCostDetails));
    costRevealTimer = window.setTimeout(revealCostDetails, 420);
  }

  $effect(() => {
    if (!expanded) {
      costExpanded = false;
      tokenDetail = null;
      resetConfirming = false;
      window.clearTimeout(costRevealTimer);
    }
  });
</script>

<section
  class="compact-quota-bar"
  class:compact-quota-bar--expanded={expanded}
  aria-label="Codex 截至目前用量"
  onpointerdown={(event) => {
    if (event.target instanceof Element && event.target.closest('button')) return;
    onDragStart(event);
  }}
>
  <div class="bar-head">
    <div class="brand" aria-hidden="true">
      <span class="brand__icon"><ProviderIcon providerId="codex" size={16} /></span>
      <span class="brand__copy"><b>Codex</b><small>{status}</small></span>
    </div>

    <div class="usage" class:usage--empty={!hasData && !hasSessionData}>
      <div class="usage__copy usage__copy--dual">
        <span data-tooltip={quotaResetText(sessionQuota)}
          >5小时 <b>{hasSessionData ? `余${sessionRemaining}%` : '—'}</b></span
        >
        <strong data-tooltip={quotaResetText(quota)}
          >7天 <b>{hasData ? `余${remaining}%` : '—'}</b></strong
        >
      </div>
      <div class="usage__tracks">
        <div
          class="usage__track usage__track--session"
          role="progressbar"
          aria-label="Codex 5 小时额度已用"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={sessionUsed}
        >
          <span style={`width: ${hasSessionData ? sessionUsed : 0}%`}></span>
        </div>
        <div
          class="usage__track usage__track--weekly"
          role="progressbar"
          aria-label="Codex 7 天额度已用"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={used}
        >
          <span style={`width: ${hasData ? used : 0}%`}></span>
        </div>
      </div>
    </div>

    <div
      class={`reminder reminder--${reminder.tone}`}
      aria-label={`用量提醒：${reminder.label}`}
      data-tooltip={reminder.detail}
    >
      <i></i><span>{reminder.label}</span>
    </div>

    <div class="actions">
      <button
        type="button"
        aria-label={expanded ? '收起详细用量' : '展开详细用量'}
        data-tooltip={expanded ? '收起详情' : '展开详情'}
        onclick={onToggle}
        ><Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={13}
          strokeWidth={2.2}
        /></button
      >
      <button
        type="button"
        aria-label="刷新 Codex 用量"
        data-tooltip="每 5 分钟自动更新；点击立即刷新"
        disabled={providerState?.refreshing}
        onclick={onRefresh}><Icon name="refresh" size={13} strokeWidth={2} /></button
      >
      <button type="button" aria-label="打开设置" data-tooltip="设置" onclick={onSettings}
        ><Icon name="gear" size={13} strokeWidth={1.9} /></button
      >
      <button type="button" aria-label="收起用量横条" data-tooltip="收起" onclick={onClose}
        ><Icon name="close" size={12} strokeWidth={2.1} /></button
      >
    </div>
  </div>

  {#if expanded}
    <div class="insight-panel">
      <section class="quota-card" aria-label="Codex 个人额度概览">
        <div class="quota-card__heading">
          <div><strong>剩余额度</strong><span>个人账户 · 截至目前</span></div>
          <span class={`quota-card__status quota-card__status--${reminder.tone}`}
            ><i></i>{reminder.label}</span
          >
        </div>
        <div class="quota-card__limits">
          <div class="quota-card__limit">
            <div class="quota-card__label">
              <strong>5 小时</strong><b
                >{hasSessionData ? `${sessionRemaining}% 剩余` : '暂无数据'}</b
              >
            </div>
            <div
              class="quota-card__track"
              role="progressbar"
              aria-label="5 小时个人额度剩余"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={sessionRemaining}
            >
              <span style={`width:${hasSessionData ? sessionRemaining : 0}%`}></span>
            </div>
            <small>{hasSessionData ? quotaResetText(sessionQuota) : '等待账户返回窗口数据'}</small>
          </div>
          <div class="quota-card__limit">
            <div class="quota-card__label">
              <strong>1 周</strong><b>{hasData ? `${remaining}% 剩余` : '暂无数据'}</b>
            </div>
            <div
              class="quota-card__track quota-card__track--weekly"
              role="progressbar"
              aria-label="1 周个人额度剩余"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={remaining}
            >
              <span style={`width:${hasData ? remaining : 0}%`}></span>
            </div>
            <small>{hasData ? quotaResetText(quota) : '等待账户返回窗口数据'}</small>
          </div>
        </div>
        {#if resetResultMessage}
          <div
            class:quota-card__notice--error={resetResult === 'failed' || resetResult === 'noCredit'}
            class="quota-card__notice"
            role="status"
          >
            {resetResultMessage}
          </div>
        {/if}
        {#if resetConfirming}
          <div class="quota-card__confirm" role="alertdialog" aria-label="确认使用个人重置额度">
            <div>
              <strong>确认使用 1 次个人重置？</strong><span
                >将同时刷新 5 小时和 7 天额度，并改变周重置日期；成功后无法撤销。</span
              ><small>{resetExpiryText(selectedResetExpiry)}</small>
            </div>
            <button type="button" disabled={resetPending} onclick={cancelResetClaim}>取消</button>
            <button
              class="quota-card__confirm-primary"
              type="button"
              disabled={resetPending}
              onclick={confirmResetClaim}>{resetPending ? '正在重置…' : '确认使用'}</button
            >
          </div>
        {:else}
          <div class="quota-card__actions">
            <button type="button" disabled={providerState?.refreshing} onclick={onRefresh}
              ><Icon name="refresh" size={11} />刷新额度</button
            >
            <button
              class="quota-card__reset"
              type="button"
              disabled={resetCount <= 0 || !resetExpiry || resetPending}
              data-tooltip={resetExpiryText(resetExpiry)}
              onclick={beginResetClaim}
              ><span>{resetCount > 0 ? `使用重置券 · ${resetCount}` : '暂无重置券'}</span><Icon
                name="reset"
                size={12}
              /></button
            >
          </div>
        {/if}
      </section>

      <div class="insight-main">
        <div class="quota-orbit" style={`--quota: ${used * 3.6}deg`}>
          <div><strong>{used}%</strong><small>7 天已用</small></div>
        </div>
        <div class="pace-copy">
          <span class={`signal signal--${pace.tone}`}><i></i> 7 天判断</span>
          <h2>{pace.label}</h2>
          <p>{pace.detail}</p>
        </div>
        <aside class="token-summary" aria-label="Codex Token 用量">
          <div class="token-summary__head"><span>Token 用量</span><i>本机日志</i></div>
          <button
            type="button"
            class="token-stat token-stat--button"
            aria-expanded={tokenDetail === 'today'}
            aria-controls="today-token-breakdown"
            data-tooltip={tokenTooltip('今日已用', todayTokens)}
            onclick={() => toggleTokenDetails('today')}
          >
            <span>今日已用</span><b
              ><strong>{formatTokens(todayTokens)}</strong><Icon
                name={tokenDetail === 'today' ? 'chevron-up' : 'chevron-down'}
                size={9}
              /></b
            >
          </button>
          <button
            type="button"
            class="token-stat token-stat--window token-stat--button"
            aria-expanded={tokenDetail === 'window'}
            aria-controls="window-token-breakdown"
            data-tooltip={tokenTooltip('本轮 7 天重置后', currentWindowTokens)}
            onclick={() => toggleTokenDetails('window')}
          >
            <span>本轮重置后</span><b
              ><strong>{formatTokens(currentWindowTokens)}</strong><Icon
                name={tokenDetail === 'window' ? 'chevron-up' : 'chevron-down'}
                size={9}
              /></b
            >
          </button>
          <div
            class="token-stat token-stat--history"
            data-tooltip={tokenTooltip('账户历史总计', accountHistoryTokens)}
          >
            <span>历史总计</span><strong>{formatTokens(accountHistoryTokens)}</strong>
          </div>
        </aside>
        {#if tokenDetail}
          {@const breakdown =
            tokenDetail === 'today' ? todayTokenBreakdown : currentWindowTokenBreakdown}
          {@const breakdownId =
            tokenDetail === 'today' ? 'today-token-breakdown' : 'window-token-breakdown'}
          <div
            class="token-breakdown"
            id={breakdownId}
            aria-label={`${tokenDetail === 'today' ? '今日已用' : '本轮重置后'} Token 分类`}
          >
            <div class="token-breakdown__heading">
              <strong>{tokenDetail === 'today' ? '今日已用' : '本轮重置后'} · 具体分类</strong>
              <span
                >{breakdown
                  ? `合计 ${formatTokens(breakdownTotal(breakdown))}`
                  : '暂无分类数据'}</span
              >
            </div>
            <div class="token-breakdown__grid">
              <div>
                <span>cached</span><strong>{formatTokens(breakdown?.cached ?? null)}</strong><small
                  >缓存命中</small
                >
              </div>
              <div>
                <span>input</span><strong>{formatTokens(breakdown?.input ?? null)}</strong><small
                  >新增输入</small
                >
              </div>
              <div data-tooltip="包含日志计入总量的输出及推理 Token">
                <span>output</span><strong>{formatTokens(breakdown?.output ?? null)}</strong><small
                  >输出 / 推理</small
                >
              </div>
            </div>
            <p>input 已扣除 cached，三项相加等于上方总量。</p>
          </div>
        {/if}
        <div class="pace-chart">
          <div class="pace-chart__heading">
            <span>7 天额度节奏</span>
            <b>{reference === null ? '参考值生成中' : `截至目前参考 ≤ ${reference}%`}</b>
          </div>
          <div class="pace-chart__track">
            <span class="pace-chart__fill" style={`width: ${used}%`}></span>
            {#if reference !== null}<i class="pace-chart__reference" style={`left: ${reference}%`}
              ></i>{/if}
          </div>
          <div class="pace-chart__legend"><span>实际用量</span><span>时间参考线</span></div>
        </div>
      </div>

      <div class="kpi-grid">
        <article>
          <small>当前余量</small><strong>{remaining}%</strong><span
            >{remaining >= 35 ? '可继续正常使用' : '建议预留给重要任务'}</span
          >
        </article>
        <article>
          <small>线性预测</small><strong>{projected === null ? '—' : `${projected}%`}</strong><span
            >{projected === null
              ? '数据积累中'
              : projected > 100
                ? '照此节奏可能提前用完'
                : '预计可平稳覆盖本周期'}</span
          >
        </article>
        <button
          class="cost-card"
          type="button"
          aria-expanded={costExpanded}
          aria-controls="cost-estimate-detail"
          onclick={toggleCostDetails}
        >
          <small>本机费用估算</small>
          <strong>{todayCny === null ? '—' : `¥${todayCny.toFixed(2)}`}</strong>
          <span>{costExpanded ? '收起费用详情' : '点开查看美元 / 人民币'}</span>
          <i aria-hidden="true"
            ><Icon name={costExpanded ? 'chevron-up' : 'chevron-down'} size={11} /></i
          >
        </button>
      </div>
      {#if costExpanded}
        <div class="cost-detail" id="cost-estimate-detail">
          <div class="cost-detail__heading">
            <div>
              <small>费用估算详情</small>
              <strong>美元与人民币对照</strong>
            </div>
            <span>参考汇率 1 USD ≈ ¥{USD_TO_CNY}</span>
          </div>
          <div class="cost-detail__table">
            <div class="cost-detail__row cost-detail__row--head">
              <span>统计周期</span><span>美元估算</span><span>人民币估算</span>
            </div>
            <div class="cost-detail__row">
              <strong>今日</strong><b>{formatUsd(todayCost)}</b><b>{formatCny(todayCny)}</b>
            </div>
            <div class="cost-detail__row">
              <strong>近 30 天</strong><b>{formatUsd(monthCost)}</b><b>{formatCny(monthCny)}</b>
            </div>
            <div class="cost-detail__row cost-detail__row--history">
              <strong class="history-label"
                ><span>账户历史</span><small>本机可查日志累计</small></strong
              ><b>{formatUsd(accountHistoryCost)}</b><b>{formatCny(accountHistoryCny)}</b>
            </div>
          </div>
          <p>
            账户历史汇总本机仍可读取的全部 Codex
            日志；费用根据模型价格推算，仅供参考，不代表订阅账单或实际扣款。
          </p>
        </div>
      {/if}
      <p class="exchange-note">
        {costExpanded
          ? '价格与汇率变化可能造成估算差异。'
          : `人民币按参考汇率 1 美元 ≈ ¥${USD_TO_CNY} 换算；点开费用卡可查看明细。`}
      </p>
    </div>
  {/if}
</section>

<style>
  .compact-quota-bar {
    position: relative;
    width: 100%;
    min-height: 52px;
    overflow: hidden;
    border: 0;
    border-radius: 14px;
    background: var(--tray);
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--text) 10%, transparent),
      0 4px 14px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(18px) saturate(128%);
    -webkit-backdrop-filter: blur(18px) saturate(128%);
  }
  .bar-head {
    position: relative;
    z-index: 1;
    display: grid;
    height: 52px;
    grid-template-columns: 28px minmax(126px, 1fr) 72px 84px;
    align-items: center;
    gap: 5px;
    padding: 7px 8px;
    cursor: default;
  }

  .brand {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 5px;
  }
  .brand__icon {
    display: grid;
    width: 24px;
    height: 24px;
    flex: 0 0 24px;
    border: 1px solid color-mix(in srgb, var(--text) 9%, transparent);
    border-radius: 8px;
    color: var(--text);
    background: color-mix(in srgb, var(--text) 5%, var(--tray));
    place-items: center;
  }
  .brand__icon :global(.provider-icon) {
    filter: none;
  }
  .brand__copy {
    display: none;
  }
  .brand__copy b {
    font-size: 12px;
    font-weight: 650;
  }
  .usage {
    min-width: 0;
  }
  .usage__copy {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 4px;
    color: var(--secondary);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }
  .usage__copy--dual > span,
  .usage__copy--dual > strong {
    display: inline-flex;
    min-width: 0;
    align-items: baseline;
    gap: 3px;
    white-space: nowrap;
  }
  .usage__copy--dual b {
    color: var(--text);
    font-size: 10px;
    font-weight: 600;
  }
  .usage__copy strong {
    color: var(--text);
    font-size: 11px;
    font-weight: 650;
  }
  .usage__tracks {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px;
  }
  .usage__track {
    height: 4px;
    overflow: hidden;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text) 8%, transparent);
  }
  .usage__track span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: color-mix(in srgb, var(--provider-codex) 72%, var(--text));
    transition: width 320ms ease;
  }
  .usage__track--weekly span {
    background: color-mix(in srgb, var(--text) 72%, var(--tray));
  }
  .usage--empty .usage__copy {
    margin-bottom: 4px;
  }
  .reminder {
    display: flex;
    height: 24px;
    min-width: 0;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 0 6px;
    border: 0;
    border-radius: 999px;
    color: var(--secondary);
    background: color-mix(in srgb, var(--text) 5%, transparent);
    font-size: 9px;
    white-space: nowrap;
  }
  .reminder i {
    width: 5px;
    height: 5px;
    flex: 0 0 5px;
    border-radius: 50%;
    background: var(--provider-codex);
  }
  .reminder--warning {
    color: color-mix(in srgb, var(--meter-warning) 82%, var(--text));
    background: color-mix(in srgb, var(--meter-warning) 8%, transparent);
  }
  .reminder--warning i {
    background: var(--meter-warning);
  }
  .reminder--danger {
    color: color-mix(in srgb, var(--meter-critical) 82%, var(--text));
    background: color-mix(in srgb, var(--meter-critical) 8%, transparent);
  }
  .reminder--danger i {
    background: var(--meter-critical);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 1px;
    padding-left: 0;
    border-left: 1px solid color-mix(in srgb, var(--text) 7%, transparent);
  }
  .actions button {
    display: grid;
    width: 20px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    color: var(--secondary);
    background: transparent;
    cursor: pointer;
    place-items: center;
  }
  .actions button:hover,
  .actions button:focus-visible {
    color: var(--text);
    background: var(--button-hover);
  }
  .actions button:disabled {
    cursor: default;
    opacity: 0.45;
  }
  .actions button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--meter-fill) 55%, transparent);
    outline-offset: 1px;
  }

  .insight-panel {
    padding: 12px;
    border-top: 1px solid var(--separator);
    background: color-mix(in srgb, var(--tray) 76%, transparent);
  }
  .quota-card {
    position: relative;
    overflow: hidden;
    margin-bottom: 10px;
    padding: 12px;
    border: 1px solid color-mix(in srgb, var(--text) 9%, transparent);
    border-radius: 14px;
    background: color-mix(in srgb, var(--text) 3%, var(--tray));
  }
  .quota-card__heading,
  .quota-card__label,
  .quota-card__actions,
  .quota-card__confirm {
    display: flex;
    align-items: center;
  }
  .quota-card__heading {
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }
  .quota-card__heading > div {
    display: flex;
    min-width: 0;
    align-items: baseline;
    gap: 7px;
  }
  .quota-card__heading strong {
    font-size: 13px;
  }
  .quota-card__heading > div > span,
  .quota-card__limit small,
  .quota-card__confirm span,
  .quota-card__confirm small {
    color: var(--secondary);
    font-size: 9px;
  }
  .quota-card__status {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 5px;
    padding: 3px 7px;
    border-radius: 999px;
    color: var(--secondary);
    background: color-mix(in srgb, var(--text) 5%, transparent);
    font-size: 9px;
  }
  .quota-card__status i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--provider-codex);
  }
  .quota-card__status--warning i {
    background: var(--meter-warning);
  }
  .quota-card__status--danger i {
    background: var(--meter-critical);
  }
  .quota-card__limits {
    display: grid;
    gap: 9px;
  }
  .quota-card__limit {
    display: grid;
    gap: 4px;
  }
  .quota-card__label {
    justify-content: space-between;
    gap: 10px;
  }
  .quota-card__label strong {
    font-size: 11px;
  }
  .quota-card__label b {
    color: var(--secondary);
    font-size: 10px;
    font-weight: 550;
    font-variant-numeric: tabular-nums;
  }
  .quota-card__track {
    height: 6px;
    overflow: hidden;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text) 10%, transparent);
  }
  .quota-card__track span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: color-mix(in srgb, var(--provider-codex) 72%, var(--text));
    transition: width 320ms ease;
  }
  .quota-card__track--weekly span {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--text) 76%, var(--provider-codex)),
      var(--text)
    );
    box-shadow: none;
  }
  .quota-card__actions {
    gap: 7px;
    margin-top: 11px;
  }
  .quota-card__actions button,
  .quota-card__confirm button {
    display: inline-flex;
    min-width: 0;
    min-height: 28px;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 4px 10px;
    border: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
    border-radius: 999px;
    color: var(--text);
    background: color-mix(in srgb, var(--text) 3%, transparent);
    font: inherit;
    font-size: 10px;
    cursor: pointer;
  }
  .quota-card__actions button:hover,
  .quota-card__actions button:focus-visible,
  .quota-card__confirm button:hover,
  .quota-card__confirm button:focus-visible {
    border-color: color-mix(in srgb, var(--provider-codex) 40%, transparent);
    outline: none;
  }
  .quota-card__actions .quota-card__reset,
  .quota-card__confirm .quota-card__confirm-primary {
    border-color: color-mix(in srgb, var(--text) 74%, transparent);
    color: var(--tray);
    background: var(--text);
    font-weight: 650;
  }
  .quota-card__actions button:disabled,
  .quota-card__confirm button:disabled {
    cursor: default;
    opacity: 0.48;
  }
  .quota-card__confirm {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7px;
    margin-top: 11px;
    padding: 8px;
    border: 1px solid color-mix(in srgb, var(--meter-warning) 30%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--meter-warning) 7%, transparent);
  }
  .quota-card__confirm > div {
    grid-column: 1 / -1;
    display: grid;
    min-width: 0;
    flex: 1.8;
    gap: 2px;
  }
  .quota-card__confirm strong {
    font-size: 10px;
  }
  .quota-card__confirm span {
    line-height: 1.6;
  }
  .quota-card__confirm button {
    min-height: 30px;
    padding-inline: 8px;
  }
  .quota-card__notice {
    margin-top: 9px;
    padding: 6px 8px;
    border-radius: 8px;
    color: color-mix(in srgb, var(--provider-codex) 75%, var(--text));
    background: color-mix(in srgb, var(--provider-codex) 8%, transparent);
    font-size: 9px;
    line-height: 12px;
  }
  .quota-card__notice--error {
    color: var(--error);
    background: var(--error-bg);
  }
  .insight-main {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr) 126px;
    align-items: center;
    gap: 8px;
  }
  .quota-orbit {
    display: grid;
    width: 58px;
    height: 58px;
    border-radius: 50%;
    background: conic-gradient(
      var(--provider-codex) 0 var(--quota),
      var(--meter-track) var(--quota) 360deg
    );
    place-items: center;
  }
  .quota-orbit::before {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: var(--tray);
    content: '';
    grid-area: 1 / 1;
  }
  .quota-orbit > div {
    display: flex;
    z-index: 1;
    flex-direction: column;
    align-items: center;
    grid-area: 1 / 1;
  }
  .quota-orbit strong {
    font-size: 16px;
    line-height: 18px;
  }
  .quota-orbit small,
  .pace-copy p,
  .kpi-grid small,
  .kpi-grid span,
  .exchange-note {
    color: var(--secondary);
  }
  .quota-orbit small {
    font-size: 8px;
  }
  .signal {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    gap: 5px;
    padding: 3px 7px;
    border-radius: 999px;
    color: var(--secondary);
    background: color-mix(in srgb, var(--text) 6%, transparent);
    font-size: 9px;
  }
  .signal i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--meter-fill);
  }
  .signal--good i {
    background: var(--provider-codex);
  }
  .signal--warning i {
    background: var(--meter-warning);
  }
  .signal--danger i {
    background: var(--meter-critical);
  }
  .pace-copy h2 {
    margin: 5px 0 2px;
    font-size: 14px;
    line-height: 16px;
  }
  .pace-copy p {
    margin: 0;
    font-size: 10px;
    line-height: 14px;
  }
  .token-summary {
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--text) 9%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--text) 3%, transparent);
    font-variant-numeric: tabular-nums;
  }
  .token-summary__head,
  .token-stat {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 5px;
    padding: 0 8px;
  }
  .token-summary__head {
    min-height: 20px;
    color: var(--secondary);
    background: color-mix(in srgb, var(--text) 3%, transparent);
    font-size: 8px;
  }
  .token-summary__head i {
    font-style: normal;
    opacity: 0.72;
  }
  .token-stat {
    min-height: 24px;
  }
  .token-stat--button {
    width: 100%;
    border: 0;
    color: inherit;
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .token-stat + .token-stat {
    border-top: 1px solid color-mix(in srgb, var(--text) 6%, transparent);
  }
  .token-stat--button:hover,
  .token-stat--button:focus-visible,
  .token-stat--button[aria-expanded='true'] {
    background: color-mix(in srgb, var(--provider-codex) 8%, transparent);
  }
  .token-stat--button:focus-visible {
    outline: 1px solid color-mix(in srgb, var(--provider-codex) 48%, transparent);
    outline-offset: -1px;
  }
  .token-stat span {
    color: var(--secondary);
    font-size: 8px;
    white-space: nowrap;
  }
  .token-stat b {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-weight: inherit;
  }
  .token-stat strong {
    color: var(--text);
    font-size: 11px;
    font-weight: 680;
    white-space: nowrap;
  }
  .token-stat--window strong {
    color: color-mix(in srgb, var(--provider-codex) 76%, white);
  }
  .token-stat--history strong {
    color: color-mix(in srgb, var(--meter-fill) 78%, white);
  }
  .token-breakdown {
    grid-column: 1 / -1;
    padding: 8px 9px 7px;
    border: 1px solid color-mix(in srgb, var(--provider-codex) 22%, transparent);
    border-radius: 10px;
    background: linear-gradient(
      115deg,
      color-mix(in srgb, var(--provider-codex) 8%, transparent),
      color-mix(in srgb, var(--text) 2%, transparent)
    );
    box-shadow: inset 0 1px color-mix(in srgb, white 4%, transparent);
    font-variant-numeric: tabular-nums;
  }
  .token-breakdown__heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .token-breakdown__heading strong {
    font-size: 10px;
  }
  .token-breakdown__heading span,
  .token-breakdown p {
    color: var(--secondary);
    font-size: 8px;
  }
  .token-breakdown__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;
  }
  .token-breakdown__grid > div {
    display: flex;
    min-width: 0;
    min-height: 42px;
    flex-direction: column;
    justify-content: center;
    padding: 5px 7px;
    border: 1px solid color-mix(in srgb, var(--text) 7%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--text) 3%, transparent);
  }
  .token-breakdown__grid span {
    color: color-mix(in srgb, var(--provider-codex) 74%, white);
    font-size: 8px;
    font-weight: 650;
    letter-spacing: 0.02em;
  }
  .token-breakdown__grid strong {
    margin: 1px 0;
    font-size: 12px;
  }
  .token-breakdown__grid small {
    overflow: hidden;
    color: var(--secondary);
    font-size: 8px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .token-breakdown p {
    margin: 6px 1px 0;
    line-height: 11px;
  }
  .pace-chart__heading,
  .pace-chart__legend {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .pace-chart__heading {
    grid-column: 1 / -1;
    align-items: baseline;
    font-size: 11px;
  }
  .pace-chart {
    grid-column: 1 / -1;
  }
  .pace-chart__heading b {
    color: var(--secondary);
    font-size: 10px;
    font-weight: 500;
  }
  .pace-chart__track {
    position: relative;
    height: 10px;
    margin: 10px 0 7px;
    border-radius: 999px;
    background: var(--meter-track);
  }
  .pace-chart__fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--provider-codex), var(--meter-fill));
  }
  .pace-chart__reference {
    position: absolute;
    top: -4px;
    width: 2px;
    height: 18px;
    border-radius: 2px;
    background: var(--text);
    box-shadow: 0 0 0 2px var(--tray);
    transform: translateX(-1px);
  }
  .pace-chart__legend {
    color: var(--secondary);
    font-size: 9px;
  }
  .pace-chart__legend span::before {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 4px;
    border-radius: 50%;
    background: var(--provider-codex);
    content: '';
  }
  .pace-chart__legend span:last-child::before {
    background: var(--text);
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-top: 10px;
  }
  .kpi-grid article,
  .cost-card {
    display: flex;
    min-width: 0;
    min-height: 62px;
    flex-direction: column;
    justify-content: center;
    padding: 7px 8px;
    border: 1px solid color-mix(in srgb, var(--text) 7%, transparent);
    border-radius: 9px;
    background: color-mix(in srgb, var(--text) 3%, transparent);
  }
  .cost-card {
    position: relative;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 140ms ease,
      background-color 140ms ease;
  }
  .cost-card:hover,
  .cost-card:focus-visible,
  .cost-card[aria-expanded='true'] {
    border-color: color-mix(in srgb, var(--provider-codex) 34%, transparent);
    background: color-mix(in srgb, var(--provider-codex) 8%, transparent);
  }
  .cost-card:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--provider-codex) 45%, transparent);
    outline-offset: 1px;
  }
  .cost-card > i {
    position: absolute;
    top: 7px;
    right: 7px;
    display: grid;
    width: 15px;
    height: 15px;
    color: var(--secondary);
    place-items: center;
  }
  .kpi-grid small {
    font-size: 9px;
  }
  .kpi-grid strong {
    margin: 2px 0;
    font-size: 14px;
  }
  .kpi-grid span {
    overflow: hidden;
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cost-detail {
    margin-top: 8px;
    padding: 9px 10px 8px;
    border: 1px solid color-mix(in srgb, var(--provider-codex) 18%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--provider-codex) 5%, transparent);
  }
  .cost-detail__heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 10px;
    padding-bottom: 7px;
  }
  .cost-detail__heading > div {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .cost-detail__heading small,
  .cost-detail__heading span,
  .cost-detail p {
    color: var(--secondary);
    font-size: 9px;
  }
  .cost-detail__heading strong {
    font-size: 11px;
  }
  .cost-detail__heading span {
    white-space: nowrap;
  }
  .cost-detail__table {
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--text) 7%, transparent);
    border-radius: 8px;
  }
  .cost-detail__row {
    display: grid;
    min-height: 27px;
    grid-template-columns: 1fr 1fr 1.15fr;
    align-items: center;
    padding: 0 8px;
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }
  .cost-detail__row + .cost-detail__row {
    border-top: 1px solid color-mix(in srgb, var(--text) 6%, transparent);
  }
  .cost-detail__row > :not(:first-child) {
    text-align: right;
  }
  .cost-detail__row b {
    color: var(--text);
    font-size: 10px;
    font-weight: 650;
  }
  .cost-detail__row--history {
    min-height: 38px;
    margin: 4px;
    padding: 3px 7px;
    border: 1px solid color-mix(in srgb, var(--provider-codex) 28%, transparent);
    border-radius: 7px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--provider-codex) 10%, transparent),
      color-mix(in srgb, var(--provider-codex) 4%, transparent)
    );
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, white 6%, transparent),
      inset 2px 0 0 color-mix(in srgb, var(--provider-codex) 54%, transparent),
      0 2px 7px rgba(0, 0, 0, 0.08);
  }
  .cost-detail__row--history strong,
  .cost-detail__row--history b {
    color: color-mix(in srgb, var(--provider-codex) 76%, var(--text));
  }
  .history-label {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 1px;
    line-height: 11px;
  }
  .history-label small {
    overflow: hidden;
    color: var(--secondary);
    font-size: 7px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cost-detail__row--head {
    min-height: 22px;
    color: var(--secondary);
    background: color-mix(in srgb, var(--text) 3%, transparent);
    font-size: 8px;
  }
  .cost-detail p {
    margin: 7px 1px 0;
    line-height: 12px;
  }
  .exchange-note {
    margin: 8px 0 0;
    font-size: 9px;
    line-height: 12px;
    text-align: right;
  }

  @media (prefers-reduced-motion: reduce) {
    .usage__track span,
    .quota-card__track span {
      transition: none;
    }
  }
</style>
