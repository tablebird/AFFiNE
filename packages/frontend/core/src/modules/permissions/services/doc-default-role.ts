import type { DocRole } from '@affine/graphql';
import {
  backoffRetry,
  catchErrorInto,
  effect,
  fromPromise,
  LiveData,
  onComplete,
  onStart,
  Service,
} from '@toeverything/infra';
import { EMPTY, exhaustMap, mergeMap } from 'rxjs';

import { isBackendError, isNetworkError } from '../../cloud';
import type { DocService } from '../../doc';
import type { WorkspaceService } from '../../workspace';
import type { DocDefaultRoleStore } from '../stores/doc-default-role';

export class DocDefaultRoleService extends Service {
  constructor(
    private readonly store: DocDefaultRoleStore,
    private readonly workspaceService: WorkspaceService,
    private readonly docService: DocService
  ) {
    super();
  }

  defaultRole$ = new LiveData<DocRole | undefined>(undefined);
  isLoading$ = new LiveData(false);
  error$ = new LiveData<any>(null);

  readonly revalidate = effect(
    exhaustMap(() => {
      return fromPromise(async signal => {
        return await this.store.fetchDocDefaultRole(
          this.workspaceService.workspace.id,
          this.docService.doc.id,
          signal
        );
      }).pipe(
        mergeMap(data => {
          this.defaultRole$.next(data);

          return EMPTY;
        }),
        backoffRetry({
          when: isNetworkError,
          count: Infinity,
        }),
        backoffRetry({
          when: isBackendError,
        }),
        catchErrorInto(this.error$),
        onStart(() => {
          this.isLoading$.setValue(true);
        }),
        onComplete(() => this.isLoading$.setValue(false))
      );
    })
  );

  async updateDocDefaultRole(role: DocRole) {
    return await this.store.updateDocDefaultRole({
      docId: this.docService.doc.id,
      workspaceId: this.workspaceService.workspace.id,
      role,
    });
  }

  override dispose(): void {
    this.revalidate.unsubscribe();
  }
}
