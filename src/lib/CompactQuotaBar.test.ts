import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { codexState } from '../test/appFixtures';
import CompactQuotaBar from './CompactQuotaBar.svelte';

afterEach(cleanup);

function renderExpandedBar(
  onContentChange = vi.fn(),
  state = codexState,
  onClaimReset = vi.fn().mockResolvedValue('success'),
) {
  return render(CompactQuotaBar, {
    state,
    now: Date.parse('2026-07-11T10:00:00Z'),
    expanded: true,
    onToggle: vi.fn(),
    onRefresh: vi.fn(),
    onSettings: vi.fn(),
    onClose: vi.fn(),
    onDragStart: vi.fn(),
    onContentChange,
    onClaimReset,
  });
}

describe('compact quota cost detail', () => {
  it('shows today, weekly-window, and account-history token totals', () => {
    renderExpandedBar();

    expect(screen.getByText('210 万')).toBeInTheDocument();
    expect(screen.getByText('472.5 万')).toBeInTheDocument();
    expect(screen.getByText('7280 万')).toBeInTheDocument();
    expect(screen.getByText('今日已用').closest('.token-stat')).toHaveAttribute(
      'data-tooltip',
      '今日已用：2,100,000 tokens（本机日志统计）',
    );
    expect(screen.getByText('本轮重置后').closest('.token-stat')).toHaveAttribute(
      'data-tooltip',
      '本轮 7 天重置后：4,725,000 tokens（本机日志统计）',
    );
    expect(screen.getByText('历史总计').closest('.token-stat')).toHaveAttribute(
      'data-tooltip',
      '账户历史总计：72,800,000 tokens（本机日志统计）',
    );
  });

  it('opens cached, input, and output classifications for today and the reset window', async () => {
    const onContentChange = vi.fn();
    renderExpandedBar(onContentChange);

    const today = screen.getByRole('button', { name: /今日已用/ });
    await fireEvent.click(today);
    expect(today).toHaveAttribute('aria-expanded', 'true');
    const todayDetail = screen.getByLabelText('今日已用 Token 分类');
    expect(within(todayDetail).getByText('cached')).toBeInTheDocument();
    expect(within(todayDetail).getByText('126 万')).toBeInTheDocument();
    expect(within(todayDetail).getByText('input')).toBeInTheDocument();
    expect(within(todayDetail).getByText('63 万')).toBeInTheDocument();
    expect(within(todayDetail).getByText('output')).toBeInTheDocument();
    expect(within(todayDetail).getByText('21 万')).toBeInTheDocument();

    const currentWindow = screen.getByRole('button', { name: /本轮重置后/ });
    await fireEvent.click(currentWindow);
    expect(today).toHaveAttribute('aria-expanded', 'false');
    expect(currentWindow).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByLabelText('今日已用 Token 分类')).not.toBeInTheDocument();
    const windowDetail = screen.getByLabelText('本轮重置后 Token 分类');
    expect(within(windowDetail).getByText('283.5 万')).toBeInTheDocument();
    expect(within(windowDetail).getByText('141.8 万')).toBeInTheDocument();
    expect(within(windowDetail).getByText('47.3 万')).toBeInTheDocument();
    expect(onContentChange).toHaveBeenCalledTimes(2);
  });

  it('shows separate 5-hour and 7-day limits with reset timing', () => {
    renderExpandedBar();

    expect(screen.getByRole('progressbar', { name: 'Codex 5 小时额度已用' })).toHaveAttribute(
      'aria-valuenow',
      '32',
    );
    expect(screen.getByRole('progressbar', { name: 'Codex 7 天额度已用' })).toHaveAttribute(
      'aria-valuenow',
      '59',
    );

    const overview = screen.getByRole('region', { name: 'Codex 个人额度概览' });
    expect(within(overview).getByText('5 小时')).toBeInTheDocument();
    expect(within(overview).getByText('68% 剩余')).toBeInTheDocument();
    expect(within(overview).getByText(/2 小时 30 分后重置/)).toBeInTheDocument();
    expect(within(overview).getByText('1 周')).toBeInTheDocument();
    expect(within(overview).getByText('41% 剩余')).toBeInTheDocument();
  });

  it('uses one personal reset only after confirming its expiry and effect', async () => {
    const onContentChange = vi.fn();
    const onClaimReset = vi.fn().mockResolvedValue('success');
    renderExpandedBar(onContentChange, codexState, onClaimReset);

    const reset = screen.getByRole('button', { name: /使用重置券 · 2/ });
    expect(reset).toHaveAttribute('data-tooltip', expect.stringContaining('最早一份将于'));
    await fireEvent.click(reset);
    expect(onClaimReset).not.toHaveBeenCalled();

    const dialog = screen.getByRole('alertdialog', { name: '确认使用个人重置额度' });
    expect(within(dialog).getByText(/同时刷新 5 小时和 7 天额度/)).toBeInTheDocument();
    await fireEvent.click(within(dialog).getByRole('button', { name: '确认使用' }));

    await waitFor(() => expect(onClaimReset).toHaveBeenCalledTimes(1));
    expect(onClaimReset).toHaveBeenCalledWith('2099-01-02T00:00:00Z', expect.any(String));
    expect(screen.getByRole('status')).toHaveTextContent('重置已生效');
    expect(onContentChange).toHaveBeenCalledTimes(2);
  });

  it('does not redeem when confirmation is cancelled or no coupon is available', async () => {
    const claim = vi.fn();
    renderExpandedBar(vi.fn(), codexState, claim);
    await fireEvent.click(screen.getByRole('button', { name: /使用重置券 · 2/ }));
    await fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(claim).not.toHaveBeenCalled();
    cleanup();
    const empty = structuredClone(codexState);
    if (empty.snapshot) empty.snapshot.valueMetrics = [];
    renderExpandedBar(vi.fn(), empty, claim);
    expect(screen.getByRole('button', { name: '暂无重置券' })).toBeDisabled();
    expect(claim).not.toHaveBeenCalled();
  });

  it('blocks repeated clicks and reuses the request id after an uncertain failure', async () => {
    let finish!: (value: 'failed') => void;
    const claim = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue('nothingToReset');
    renderExpandedBar(vi.fn(), codexState, claim);
    await fireEvent.click(screen.getByRole('button', { name: /使用重置券 · 2/ }));
    await fireEvent.click(screen.getByRole('button', { name: '确认使用' }));
    const pending = screen.getByRole('button', { name: '正在重置…' });
    expect(pending).toBeDisabled();
    await fireEvent.click(pending);
    expect(claim).toHaveBeenCalledTimes(1);
    finish('failed');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('重置未成功'));
    await fireEvent.click(screen.getByRole('button', { name: /使用重置券 · 2/ }));
    await fireEvent.click(screen.getByRole('button', { name: '确认使用' }));
    expect(claim).toHaveBeenCalledTimes(2);
    expect(claim.mock.calls[1]).toEqual(claim.mock.calls[0]);
    expect(screen.getByRole('status')).toHaveTextContent('本次不会消耗');
  });

  it('names the affected period and surfaces whichever limit is more urgent', () => {
    renderExpandedBar();
    expect(screen.getByLabelText('用量提醒：7天偏快')).toHaveAttribute(
      'data-tooltip',
      expect.stringContaining('7 天用量略快'),
    );
    cleanup();

    const sessionCriticalState = structuredClone(codexState);
    const sessionQuota = sessionCriticalState.snapshot?.quotas.find(
      (item) => item.id === 'session',
    );
    if (!sessionQuota) throw new Error('Codex session fixture is missing');
    sessionQuota.resetsAt = '2026-07-11T14:50:00Z';
    renderExpandedBar(vi.fn(), sessionCriticalState);

    expect(screen.getByLabelText('用量提醒：5小时过快')).toHaveAttribute(
      'data-tooltip',
      expect.stringContaining('5 小时：用量明显偏快'),
    );
  });

  it('opens and closes an accessible cost estimate detail from the KPI card', async () => {
    const onContentChange = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    renderExpandedBar(onContentChange);
    const trigger = screen.getByRole('button', { name: /本机费用估算/ });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('美元与人民币对照')).not.toBeInTheDocument();

    await fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('美元与人民币对照')).toBeInTheDocument();
    await waitFor(() => expect(onContentChange).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'end', behavior: 'smooth' }),
    );

    await fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('美元与人民币对照')).not.toBeInTheDocument();
    await waitFor(() => expect(onContentChange).toHaveBeenCalledTimes(2));
    if (originalScrollIntoView) {
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView,
      });
    } else {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    }
  });

  it('shows today, 30-day, and account-history estimates in both currencies', async () => {
    renderExpandedBar();
    await fireEvent.click(screen.getByRole('button', { name: /本机费用估算/ }));

    expect(screen.getByText('$3.84')).toBeInTheDocument();
    expect(screen.getByText('$5.11')).toBeInTheDocument();
    expect(screen.getByText('$123.45')).toBeInTheDocument();
    expect(screen.getAllByText('¥25.92')).toHaveLength(2);
    expect(screen.getByText('¥34.49')).toBeInTheDocument();
    expect(screen.getByText('¥833.29')).toBeInTheDocument();
    expect(screen.getByText('账户历史')).toBeInTheDocument();
    expect(screen.getByText('本机可查日志累计')).toBeInTheDocument();
    expect(screen.getByText(/本机仍可读取的全部 Codex 日志/)).toBeInTheDocument();
    expect(screen.getByText(/不代表订阅账单或实际扣款/)).toBeInTheDocument();
  });
});
