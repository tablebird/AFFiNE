import type { WorkspaceServerService } from '@affine/core/modules/cloud';
import {
  getDocDefaultRoleQuery,
  type UpdateDocDefaultRoleInput,
  updateDocDefaultRoleMutation,
} from '@affine/graphql';
import { Store } from '@toeverything/infra';

export class DocDefaultRoleStore extends Store {
  constructor(private readonly workspaceServerService: WorkspaceServerService) {
    super();
  }

  async fetchDocDefaultRole(
    workspaceId: string,
    docId: string,
    signal?: AbortSignal
  ) {
    if (!this.workspaceServerService.server) {
      throw new Error('No Server');
    }
    const res = await this.workspaceServerService.server.gql({
      query: getDocDefaultRoleQuery,
      variables: {
        workspaceId,
        docId,
      },
      context: { signal },
    });

    return res.workspace.doc.defaultRole;
  }

  async updateDocDefaultRole(input: UpdateDocDefaultRoleInput) {
    if (!this.workspaceServerService.server) {
      throw new Error('No Server');
    }
    const res = await this.workspaceServerService.server.gql({
      query: updateDocDefaultRoleMutation,
      variables: {
        input,
      },
    });

    return res.updateDocDefaultRole;
  }
}
