import type { DialogProps } from '@radix-ui/react-dialog';

export interface BaseDialogProps {
    dialog: DialogProps;
}

export interface BaseImportDialogProps {
    dialog: DialogProps;
    setOpenDialog?: (value: boolean) => void;
}
