import { Fragment, useEffect } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { useOperatorStore } from '../store/operatorStore';
import { useAuthStore } from '../store/authStore';
import { operatorsApi } from '../services/api';
import clsx from 'clsx';

export default function OperatorSwitcher() {
  const { user } = useAuthStore();
  const { operators, selectedOperator, setOperators, selectOperator, setLoading, isLoading } = useOperatorStore();

  // Fetch operators on mount
  useEffect(() => {
    const fetchOperators = async () => {
      try {
        setLoading(true);
        const response = await operatorsApi.list();
        if (response.success && response.data) {
          setOperators(response.data);
          // Auto-select first operator if none selected
          if (!selectedOperator && response.data.length > 0) {
            // If user has an operator, select that one
            if (user?.operatorId) {
              const userOperator = response.data.find(op => op.id === user.operatorId);
              if (userOperator) {
                selectOperator(userOperator);
              }
            } else {
              // Super admin - select first one
              selectOperator(response.data[0]);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch operators:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOperators();
  }, [user?.operatorId]);

  // If user is tied to a single operator, just show the operator name (no switching)
  if (user?.operatorId && operators.length <= 1) {
    const op = selectedOperator || operators[0];
    if (!op) return null;

    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
        <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
        <div>
          <p className="text-sm font-medium text-white">{op.shortName || op.name}</p>
          <p className="text-xs text-gray-400">{op.code}</p>
        </div>
      </div>
    );
  }

  // Super admin or user with access to multiple operators - show switcher
  return (
    <Listbox value={selectedOperator} onChange={selectOperator}>
      {({ open }) => (
        <div className="relative">
          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-gray-800 py-2 pl-3 pr-10 text-left shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm">
            <span className="flex items-center gap-2">
              {selectedOperator?.primaryColor && (
                <span
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedOperator.primaryColor }}
                />
              )}
              <span className="block truncate text-white">
                {isLoading ? 'Loading...' : selectedOperator?.shortName || selectedOperator?.name || 'Select Operator'}
              </span>
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </span>
          </Listbox.Button>

          <Transition
            show={open}
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {operators.map((operator) => (
                <Listbox.Option
                  key={operator.id}
                  className={({ active }) =>
                    clsx(
                      active ? 'bg-gray-700 text-white' : 'text-gray-300',
                      'relative cursor-pointer select-none py-2 pl-3 pr-9'
                    )
                  }
                  value={operator}
                >
                  {({ selected, active }) => (
                    <>
                      <div className="flex items-center gap-2">
                        {operator.primaryColor && (
                          <span
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: operator.primaryColor }}
                          />
                        )}
                        <span className={clsx(selected ? 'font-semibold' : 'font-normal', 'block truncate')}>
                          {operator.shortName || operator.name}
                        </span>
                        <span className="text-gray-500 text-xs">({operator.code})</span>
                      </div>

                      {selected ? (
                        <span
                          className={clsx(
                            active ? 'text-white' : 'text-primary-400',
                            'absolute inset-y-0 right-0 flex items-center pr-4'
                          )}
                        >
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      )}
    </Listbox>
  );
}
