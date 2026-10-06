'use client';

import { Check, Gift, Send, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactElement } from 'react';
import {
  ForumPaySheet,
  type ForumPayError,
  type ForumPayInvoice,
} from '@/components/ForumPaySheet';
import { useTranslations } from '@/components/LocaleProvider';
import { SundayWritingGate } from '@/components/SundayWritingGate';
import { Field, IconButton } from '@/components/ui';
import type { Account, AmountUnit } from '@/lib/api-types';
import type { MemberHabitList } from '@/lib/member-habits';
import { roleAtLeast } from '@/lib/roles';
import type { FiatRateDay } from '@/lib/stats-money';

type MemberHabit = MemberHabitList['habits'][number];

type HabitCommentsProps = {
  habit: MemberHabit;
  account: Account | null;
  session: string | null;
  commentText: string;
  payCommentId: string | null;
  payDraft: string;
  payBusy: boolean;
  payError: ForumPayError;
  payInvoice: ForumPayInvoice | null;
  rateDay: FiatRateDay | null;
  ratePending: boolean;
  showPaymentQr: boolean;
  onPayOpen: (commentId: string) => void;
  onPayDraftChange: (value: string) => void;
  onPayUnitChange: (unit: AmountUnit) => void;
  onPaySubmit: () => void;
  onPayCancel: () => void;
  onCommentText: (value: string) => void;
  onPostComment: () => void;
  onDeleteComment: (commentId: string) => void;
};

/**
 * Public comments on one habit, including delete and the Bitcoin gift sheet.
 *
 * Comment, delete, and the gift sit in {@link SundayWritingGate}. Rating,
 * edit, archive, and add do not. Does not log comment text or invoices.
 *
 * @param props - The habit, the viewer, and the pay-sheet state owned by
 *   {@link MemberHabits}.
 * @returns The comment block for that habit.
 */
export function HabitComments(props: HabitCommentsProps): ReactElement {
  const { t } = useTranslations();
  const [confirmingCommentId, setConfirmingCommentId] = useState<string | null>(null);
  const {
    habit,
    account,
    session,
    commentText,
    payCommentId,
    payDraft,
    payBusy,
    payError,
    payInvoice,
    rateDay,
    ratePending,
    showPaymentQr,
    onPayOpen,
    onPayDraftChange,
    onPayUnitChange,
    onPaySubmit,
    onPayCancel,
    onCommentText,
    onPostComment,
    onDeleteComment,
  } = props;
  const canDelete = account !== null && roleAtLeast(account.role, 'initiator');
  const canPay = session !== null && session !== '' && account !== null;

  return (
    <div className="flex flex-col gap-3 border-t border-app-border pt-3">
      <h4 className="text-sm font-semibold text-app-fg">{t('habit.comments')}</h4>
      <p className="text-sm text-app-muted">{t('habit.commentHint')}</p>
      {habit.comments.length === 0 ? (
        <p className="text-sm text-app-muted">{t('habit.noComments')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {habit.comments.map((comment) => {
            const showGift = canPay && account !== null && comment.accountId !== account.id;
            return (
              <li key={comment.id} className="flex flex-col gap-2 text-sm text-app-fg">
                <p>
                  <span className="font-medium">{comment.name}</span>
                  {': '}
                  <span>{comment.text}</span>
                </p>
                {canDelete || showGift ? (
                  <div className="flex flex-wrap items-center gap-5">
                    {canDelete ? (
                      <SundayWritingGate>
                        {confirmingCommentId === comment.id ? (
                          <div
                            role="group"
                            aria-label={t('habit.deleteCommentConfirm')}
                            className="order-last mt-2 w-full basis-full"
                          >
                            <div className="flex flex-col gap-2 rounded-xl border border-app-border p-3">
                              <p className="text-sm text-app-fg">
                                {t('habit.deleteCommentConfirm')}
                              </p>
                              <div className="flex gap-3">
                                <IconButton
                                  type="button"
                                  aria-label={t('forum.deleteConfirmAction')}
                                  onClick={() => {
                                    setConfirmingCommentId(null);
                                    onDeleteComment(comment.id);
                                  }}
                                >
                                  <Check aria-hidden="true" className="h-4 w-4" />
                                </IconButton>
                                <IconButton
                                  type="button"
                                  aria-label={t('forum.deleteCancel')}
                                  onClick={() => {
                                    setConfirmingCommentId(null);
                                  }}
                                >
                                  <X aria-hidden="true" className="h-4 w-4" />
                                </IconButton>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <IconButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={t('habit.deleteComment')}
                            onClick={() => {
                              setConfirmingCommentId(comment.id);
                            }}
                          >
                            <Trash2 aria-hidden="true" className="h-4 w-4 text-app-danger" />
                          </IconButton>
                        )}
                      </SundayWritingGate>
                    ) : null}
                    {showGift ? (
                      <SundayWritingGate notice="zap">
                        <IconButton
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={t('forum.pay')}
                          disabled={payBusy}
                          onClick={() => {
                            onPayOpen(comment.id);
                          }}
                        >
                          <Gift aria-hidden="true" className="h-4 w-4 shrink-0" />
                        </IconButton>
                      </SundayWritingGate>
                    ) : null}
                  </div>
                ) : null}
                {showGift && payCommentId === comment.id ? (
                  <SundayWritingGate notice="zap">
                    <ForumPaySheet
                      messageId={comment.id}
                      payDraft={payDraft}
                      payBusy={payBusy}
                      payError={payError}
                      payInvoice={payInvoice}
                      payWaiting={false}
                      onPayDraftChange={onPayDraftChange}
                      onPayUnitChange={onPayUnitChange}
                      onPaySubmit={onPaySubmit}
                      onPayCancel={onPayCancel}
                      rateDay={rateDay}
                      ratePending={ratePending}
                      showPaymentQr={showPaymentQr}
                      onInteract={() => undefined}
                    />
                  </SundayWritingGate>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {account !== null ? (
        <SundayWritingGate>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field
                id={`habit-${habit.id}-comment`}
                label={t('habit.writeComment')}
                multiline
                value={commentText}
                onChange={(event) => {
                  onCommentText(event.target.value);
                }}
              />
            </div>
            <IconButton
              type="button"
              size="lg"
              variant="primary"
              aria-label={t('habit.post')}
              onClick={onPostComment}
            >
              <Send aria-hidden="true" className="block h-5 w-5 shrink-0" />
            </IconButton>
          </div>
        </SundayWritingGate>
      ) : null}
      {session === null ? (
        <Link
          href="/login"
          className="text-sm font-medium text-app-fg underline underline-offset-2"
        >
          {t('habit.login')}
        </Link>
      ) : null}
    </div>
  );
}
