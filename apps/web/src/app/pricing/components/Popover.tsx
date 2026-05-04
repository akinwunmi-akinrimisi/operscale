'use client';

// Popover wrapper used by DayCell on hover/tap.
// Thin re-export over @radix-ui/react-popover. Keeps imports tidy for the
// calendar preview components.

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from '@radix-ui/react-popover';
