/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/update.contribution';
import 'vs/platform/update/node/update.config.contribution';
import * as platform from 'vs/base/common/platform';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { IGlobalActivityRegistry, GlobalActivityExtensions } from 'vs/workbench/common/activity';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { ShowCurrentReleaseNotesAction, ProductContribution, UpdateContribution, Win3264BitContribution, WinUserSetupContribution } from './update';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import product from 'vs/platform/node/product';

const workbench = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);

workbench.registerWorkbenchContribution(ProductContribution, LifecyclePhase.Running);

if (platform.isWindows) {
	if (process.arch === 'ia32') {
		workbench.registerWorkbenchContribution(Win3264BitContribution, LifecyclePhase.Running);
	}

	if (product.target !== 'user') {
		workbench.registerWorkbenchContribution(WinUserSetupContribution, LifecyclePhase.Running);
	}
}

Registry.as<IGlobalActivityRegistry>(GlobalActivityExtensions)
	.registerActivity(UpdateContribution);

// Editor
Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions)
	.registerWorkbenchAction(new SyncActionDescriptor(ShowCurrentReleaseNotesAction, ShowCurrentReleaseNotesAction.ID, ShowCurrentReleaseNotesAction.LABEL), 'Show Release Notes');
