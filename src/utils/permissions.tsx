import { atom, getDefaultStore, useAtomValue } from "jotai";
import browser, { Manifest } from 'webextension-polyfill';

export type CorrectPermission = Manifest.OptionalPermission | 'tabGroups' | 'favicon';

export const availablePermissionsAtom = atom<null | { hosts: string[], permissions: CorrectPermission[], }>(null);

export const containsHostPermission = (hostPermissions: string[], host: string) => {
    return hostPermissions.some(grantedHost => grantedHost.toLowerCase().includes(normalizeHost(host)));
};

export const normalizeHost = (host: string) => {
    let correctedHost = host;
    if (correctedHost.includes('://')) correctedHost = correctedHost.split('://')[1];
    if (correctedHost.includes('/')) correctedHost = correctedHost.split('/')[0];
    return correctedHost.toLowerCase();
};

export const updateAvailablePermissions = async () => {
    const current = await browser.permissions.getAll();
    const atomStore = getDefaultStore();
    atomStore.set(availablePermissionsAtom, {
        permissions: current.permissions as CorrectPermission[] || [],
        hosts: current.origins || [],
    });
};

export const watchForPermissionChanges = async () => {
    const current = await browser.permissions.getAll();
    const atomStore = getDefaultStore();
    atomStore.set(availablePermissionsAtom, {
        permissions: current.permissions as CorrectPermission[] || [],
        hosts: current.origins || [],
    });

    browser.permissions.onAdded.addListener((addedPermissions) => {
        const currentPermissions = atomStore.get(availablePermissionsAtom);
        if (!currentPermissions) return;
        const newPermissions = {
            permissions: [...currentPermissions.permissions, ...(addedPermissions.permissions || [])],
            hosts: [...currentPermissions.hosts, ...(addedPermissions.origins || [])],
        };
        atomStore.set(availablePermissionsAtom, newPermissions);
    });
    browser.permissions.onAdded.addListener((removedPermissions) => {
        const currentPermissions = atomStore.get(availablePermissionsAtom);
        if (!currentPermissions) return;
        const newPermissions = {
            permissions: currentPermissions.permissions.filter(p => !((removedPermissions.permissions || []) as CorrectPermission[]).includes(p)),
            hosts: currentPermissions.hosts.filter(p => !(removedPermissions.origins || []).includes(p)),
        };
        atomStore.set(availablePermissionsAtom, newPermissions);
    });
};

export const permissionUnavailableOnFirefox = ['favicon'];

export const useAvailablePermissions = () => {
    const currentPermissions = useAtomValue(availablePermissionsAtom);
    return currentPermissions || { hosts: [], permissions: [] };
};

export const usePermissionsQuery = ({ hosts, permissions }: { hosts?: string[], permissions?: CorrectPermission[], }) => {
    const availablePermissions = useAvailablePermissions();
    const isFirefox = navigator.userAgent.includes('Firefox/');
    const missingPermissions = permissions ? permissions.filter(p => !availablePermissions.permissions.includes(p)).filter(p => isFirefox ? !permissionUnavailableOnFirefox.includes(p) : true) : [];
    const missingHostPermissions = hosts ? hosts.filter(h => !containsHostPermission(availablePermissions.hosts, h)) : [];

    return missingPermissions.length === 0 && missingHostPermissions.length === 0;
};