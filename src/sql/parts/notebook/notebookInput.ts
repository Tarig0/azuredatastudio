/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { EditorInput, EditorModel, ConfirmResult } from 'vs/workbench/common/editor';
import { Emitter, Event } from 'vs/base/common/event';
import URI from 'vs/base/common/uri';
import { IContextKeyService, ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';

import { INotebookService } from 'sql/services/notebook/notebookService';

export type ModeViewSaveHandler = (handle: number) => Thenable<boolean>;

export let notebooksEnabledCondition = ContextKeyExpr.equals('config.notebook.enabled', true);


export class NotebookInputModel extends EditorModel {
	private dirty: boolean;
	private readonly _onDidChangeDirty: Emitter<void> = this._register(new Emitter<void>());
	private _providerId: string;
	constructor(public readonly notebookUri: URI, private readonly handle: number, private _isTrusted: boolean = false, private saveHandler?: ModeViewSaveHandler) {
		super();
		this.dirty = false;
	}

	public get providerId(): string {
		return this._providerId;
	}

	public set providerId(value: string) {
		this._providerId = value;
	}

	get isTrusted(): boolean {
		return this._isTrusted;
	}

	get onDidChangeDirty(): Event<void> {
		return this._onDidChangeDirty.event;
	}

	get isDirty(): boolean {
		return this.dirty;
	}

	public setDirty(dirty: boolean): void {
		if (this.dirty === dirty) {
			return;
		}

		this.dirty = dirty;
		this._onDidChangeDirty.fire();
	}

	save(): TPromise<boolean> {
		if (this.saveHandler) {
			return TPromise.wrap(this.saveHandler(this.handle));
		}
		return TPromise.wrap(true);
	}
}

export class NotebookInputValidator {

	constructor(@IContextKeyService private readonly _contextKeyService: IContextKeyService) {}

	public isNotebookEnabled(): boolean {
		return this._contextKeyService.contextMatchesRules(notebooksEnabledCondition);
	}
}

export class NotebookInput extends EditorInput {

	public static ID: string = 'workbench.editorinputs.notebookInput';

	public hasBootstrapped = false;
	// Holds the HTML content for the editor when the editor discards this input and loads another
	private _parentContainer: HTMLElement;

	constructor(private _title: string,
		private _model: NotebookInputModel,
		@INotebookService private notebookService: INotebookService
	) {
		super();
		this._model.onDidChangeDirty(() => this._onDidChangeDirty.fire());
		this.onDispose(() => {
			if (this.notebookService) {
				this.notebookService.handleNotebookClosed(this.notebookUri);
			}
		});
	}

	public get title(): string {
		return this._title;
	}

	public get notebookUri(): URI {
		return this._model.notebookUri;
	}

	public get providerId(): string {
		return this._model.providerId;
	}

	public getTypeId(): string {
		return NotebookInput.ID;
	}

	public resolve(refresh?: boolean): TPromise<IEditorModel> {
		return undefined;
	}

	public getName(): string {
		return this._title;
	}

	public get isTrusted(): boolean {
		return this._model.isTrusted;
	}

	public dispose(): void {
		this._disposeContainer();
		super.dispose();
	}

	private _disposeContainer() {
		if (!this._parentContainer) {
			return;
		}

		let parentNode = this._parentContainer.parentNode;
		if (parentNode) {
			parentNode.removeChild(this._parentContainer);
			this._parentContainer = null;
		}
	}

	set container(container: HTMLElement) {
		this._disposeContainer();
		this._parentContainer = container;
	}

	get container(): HTMLElement {
		return this._parentContainer;
	}

	/**
	 * An editor that is dirty will be asked to be saved once it closes.
	 */
	isDirty(): boolean {
		return this._model.isDirty;
	}

	/**
	 * Subclasses should bring up a proper dialog for the user if the editor is dirty and return the result.
	 */
	confirmSave(): TPromise<ConfirmResult> {
		// TODO #2530 support save on close / confirm save. This is significantly more work
		// as we need to either integrate with textFileService (seems like this isn't viable)
		// or register our own complimentary service that handles the lifecycle operations such
		// as close all, auto save etc.
		return TPromise.wrap(ConfirmResult.DONT_SAVE);
	}

	/**
	 * Saves the editor if it is dirty. Subclasses return a promise with a boolean indicating the success of the operation.
	 */
	save(): TPromise<boolean> {
		return this._model.save();
	}
}