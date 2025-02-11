import { Menu, MenuItem, MenuTrigger } from '@affine/component';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import { DocDefaultRoleService } from '@affine/core/modules/permissions';
import { DocRole } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo } from 'react';

import { PlanTag } from '../plan-tag';
import * as styles from './styles.css';

const getRoleName = (t: ReturnType<typeof useI18n>, role?: DocRole) => {
  switch (role) {
    case DocRole.Manager:
      return t['com.affine.share-menu.option.permission.can-manage']();
    case DocRole.Editor:
      return t['com.affine.share-menu.option.permission.can-edit']();
    case DocRole.Reader:
      return t['com.affine.share-menu.option.permission.can-read']();
    default:
      return '';
  }
};

export const MembersPermission = ({
  openPaywallModal,
  hittingPaywall,
  disabled,
}: {
  hittingPaywall: boolean;
  openPaywallModal?: () => void;
  disabled?: boolean;
}) => {
  const t = useI18n();
  const docDefaultRoleService = useService(DocDefaultRoleService);
  const docDefaultRole = useLiveData(docDefaultRoleService.defaultRole$);
  const currentRoleName = useMemo(
    () => getRoleName(t, docDefaultRole),
    [docDefaultRole, t]
  );

  const changePermission = useCallback(
    async (docRole: DocRole) => {
      await docDefaultRoleService.updateDocDefaultRole(docRole);
      docDefaultRoleService.revalidate();
    },
    [docDefaultRoleService]
  );

  const selectManage = useAsyncCallback(async () => {
    await changePermission(DocRole.Manager);
  }, [changePermission]);

  const selectEdit = useAsyncCallback(async () => {
    if (hittingPaywall) {
      openPaywallModal?.();
      return;
    }
    await changePermission(DocRole.Editor);
  }, [changePermission, hittingPaywall, openPaywallModal]);

  const selectRead = useAsyncCallback(async () => {
    if (hittingPaywall) {
      openPaywallModal?.();
      return;
    }
    await changePermission(DocRole.Reader);
  }, [changePermission, hittingPaywall, openPaywallModal]);

  useEffect(() => {
    docDefaultRoleService.revalidate();
  }, [docDefaultRoleService]);
  return (
    <div className={styles.rowContainerStyle}>
      <div className={styles.labelStyle}>
        {t['com.affine.share-menu.option.permission.label']()}
      </div>
      <Menu
        contentOptions={{
          align: 'end',
        }}
        items={
          disabled ? null : (
            <>
              <MenuItem
                onSelect={selectManage}
                selected={docDefaultRole === DocRole.Manager}
              >
                <div className={styles.publicItemRowStyle}>
                  {t['com.affine.share-menu.option.permission.can-manage']()}
                </div>
              </MenuItem>
              <MenuItem
                onSelect={selectEdit}
                selected={docDefaultRole === DocRole.Editor}
              >
                <div className={styles.publicItemRowStyle}>
                  <div className={styles.tagContainerStyle}>
                    {t['com.affine.share-menu.option.permission.can-edit']()}
                    <PlanTag />
                  </div>
                </div>
              </MenuItem>
              <MenuItem
                onSelect={selectRead}
                selected={docDefaultRole === DocRole.Reader}
              >
                <div className={styles.publicItemRowStyle}>
                  <div className={styles.tagContainerStyle}>
                    {t['com.affine.share-menu.option.permission.can-read']()}
                    <PlanTag />
                  </div>
                </div>
              </MenuItem>
            </>
          )
        }
      >
        <MenuTrigger
          className={styles.menuTriggerStyle}
          variant="plain"
          contentStyle={{
            width: '100%',
          }}
          disabled={disabled}
        >
          {currentRoleName}
        </MenuTrigger>
      </Menu>
    </div>
  );
};
