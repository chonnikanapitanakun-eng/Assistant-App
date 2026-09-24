import { saveCaptureItems } from '@/features/ai/save';
import { getBill, markBillPaid } from '@/features/money/queries';
import { getTask, rescheduleTask, toggleTaskDone } from '@/features/tasks/queries';

import type { Proposal } from './types';

/** Carry out a proposal the user confirmed. Returns false when it couldn't be done (e.g. the item is gone). */
export function runProposal(p: Proposal): boolean {
  switch (p.kind) {
    case 'create':
      return saveCaptureItems(p.items) > 0;
    case 'complete_task': {
      const task = getTask(p.taskId);
      if (!task) return false;
      if (!task.isDone) toggleTaskDone(task);
      return true;
    }
    case 'reschedule_task': {
      const task = getTask(p.taskId);
      if (!task) return false;
      rescheduleTask(task, p.date, p.startTime, p.endTime);
      return true;
    }
    case 'pay_bill': {
      const bill = getBill(p.billId);
      return bill ? markBillPaid(bill) : false;
    }
  }
}
