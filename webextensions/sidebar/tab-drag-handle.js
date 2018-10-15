/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as Tabs from '/common/tabs.js';
import * as Size from './size.js';
import * as EventUtils from './event-utils.js';
import * as DragAndDrop from './drag-and-drop.js';

function log(...args) {
  internalLogger('sidebar/tab-drag-handle', ...args);
}

let mTabDragHandle;

let mTargetTabId;
let mLastX;
let mLastY;

let mShowTimer;
let mHideTimer;

export function init() {
  mTabDragHandle = document.querySelector('#tab-drag-handle');

  document.addEventListener('mousemove', onMouseMove, { capture: true, passive: true });
  document.addEventListener('scroll', () => hideTabDragHandle(), true);
  document.addEventListener('click', () => hideTabDragHandle(), true);
  mTabDragHandle.addEventListener('dragstart', onTabDragHandleDragStart);
}

function showTabDragHandle(tab) {
  if (showTabDragHandle.timer)
    clearTimeout(showTabDragHandle.timer);
  showTabDragHandle.timer = setTimeout(() => {
    delete showTabDragHandle.timer;
    reallyShowTabDragHandle(tab);
  }, 100);
}
function reallyShowTabDragHandle(tab) {
  if (!configs.showTabDragHandle ||
      !Tabs.ensureLivingTab(tab) ||
      !tab.matches(':hover'))
    return;

  if (mShowTimer) {
    clearTimeout(mShowTimer);
    mShowTimer = null;
  }

  mTabDragHandle.classList.remove('animating');
  mTabDragHandle.classList.remove('shown');

  for (const activeItem of mTabDragHandle.querySelectorAll('.active')) {
    activeItem.classList.remove('active');
  }

  mTargetTabId = tab.id;
  if (Tabs.hasChildTabs(tab))
    mTabDragHandle.classList.add('has-child');
  else
    mTabDragHandle.classList.remove('has-child');

  const x = mLastX;
  const y = mLastY;

  if (Tabs.isPinned(tab) ||
      configs.sidebarPosition == Constants.kTABBAR_POSITION_LEFT) {
    mTabDragHandle.style.right = '';
    mTabDragHandle.style.left  = `${x + 1}px`;
  }
  else {
    mTabDragHandle.style.left  = '';
    mTabDragHandle.style.right = `${x - 1}px`;
  }
  mTabDragHandle.style.bottom = '';
  mTabDragHandle.style.top    = `${y + 1}px`;

  // reposition
  const handlerRect = mTabDragHandle.getBoundingClientRect();
  if (handlerRect.left < 0) {
    mTabDragHandle.style.right = '';
    mTabDragHandle.style.left  = 0;
  }
  else if (handlerRect.right > window.innerWidth) {
    mTabDragHandle.style.left  = '';
    mTabDragHandle.style.right = 0;
  }
  if (handlerRect.bottom > window.innerHeight)
    mTabDragHandle.style.top = `${y - handlerRect.height - 1}px`;

  mTabDragHandle.classList.add('animating');
  mTabDragHandle.classList.add('shown');
  setTimeout(() => {
    if (mTabDragHandle.classList.contains('shown'))
      mTabDragHandle.classList.remove('animating');
  }, configs.collapseDuration);
}

function reserveToShowTabDragHandle(tab) {
  if (mHideTimer) {
    clearTimeout(mHideTimer);
    mHideTimer = null;
  }
  mShowTimer = setTimeout(() => {
    mShowTimer = null;
    showTabDragHandle(tab);
  }, configs.tabDragHandleDelay);
}

function hideTabDragHandle() {
  if (mShowTimer) {
    clearTimeout(mShowTimer);
    mShowTimer = null;
  }
  mTabDragHandle.classList.add('animating');
  mTabDragHandle.classList.remove('shown');
  mTargetTabId = null;
}

function reserveToHideTabDragHandle() {
  if (mShowTimer) {
    clearTimeout(mShowTimer);
    mShowTimer = null;
  }
  mHideTimer = setTimeout(() => {
    mHideTimer = null;
    hideTabDragHandle();
  }, configs.subMenuCloseDelay);
}

function onMouseMove(event) {
  if (!configs.showTabDragHandle)
    return;

  mLastX = event.clientX;
  mLastY = event.clientY;

  // We need to use coordinates because elements with
  // "pointer-events:none" won't be found by element.closest().
  const dragHandlerRect = mTabDragHandle.getBoundingClientRect();
  if (mTabDragHandle.classList.contains('shown') &&
      event.clientX >= dragHandlerRect.left &&
      event.clientY >= dragHandlerRect.top &&
      event.clientX <= dragHandlerRect.right &&
      event.clientY <= dragHandlerRect.bottom) {
    if (mHideTimer) {
      clearTimeout(mHideTimer);
      mHideTimer = null;
    }
    return;
  }

  const tab    = EventUtils.getTabFromEvent(event);
  const target = EventUtils.getElementTarget(event.target);
  if (tab) {
    const tabRect  = tab.getBoundingClientRect();
    const areaSize = Size.getFavIconSize();
    const onLeft   = Tabs.isPinned(tab) || configs.sidebarPosition == Constants.kTABBAR_POSITION_LEFT;
    const onArea   = (onLeft &&
                      event.clientX >= tabRect.left &&
                      event.clientX <= tabRect.left + areaSize) ||
                     (!onLeft &&
                      event.clientX <= tabRect.right &&
                      event.clientX >= tabRect.right - areaSize);
    if (onArea) {
      if (mTargetTabId != tab.id)
        reserveToShowTabDragHandle(tab);
    }
    else {
      reserveToHideTabDragHandle();
    }
  }
  else if (!target || !target.closest(`#${mTabDragHandle.id}`)) {
    reserveToHideTabDragHandle();
  }
}
onMouseMove = EventUtils.wrapWithErrorHandler(onMouseMove);

function onTabDragHandleDragStart(event) {
  // get target tab at first before it is cleared by hideTabDragHandle()
  const targetTab = Tabs.getTabById(mTargetTabId);
  log('onTabDragHandleDragStart: targetTab = ', mTargetTabId, targetTab);

  if (!targetTab) {
    hideTabDragHandle();
    return;
  }

  event.stopPropagation();

  const target = EventUtils.getElementTarget(event.target);
  target.classList.add('active');
  target.classList.add('animating');

  setTimeout(() => {
    hideTabDragHandle();
  }, configs.tabDragHandleFeedbackDuration);

  return DragAndDrop.onDragStart(event, {
    target:                  targetTab,
    shouldIgnoreDescendants: !!target.closest('.shouldIgnoreDescendants'),
    allowBookmark:           !!target.closest('.allowBookmark')
  });
}
onTabDragHandleDragStart = EventUtils.wrapWithErrorHandler(onTabDragHandleDragStart);
