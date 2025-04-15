import type { DialogProps } from '@radix-ui/react-dialog';

export interface BaseDialogProps {
    dialog: DialogProps;
}

export interface BaseImportDialogProps {
    dialog: DialogProps;
    setOpenImportDBMLDialog: React.Dispatch<React.SetStateAction<boolean>>;
}
