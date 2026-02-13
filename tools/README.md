# Tools Directory

Organized collection of scripts for verification, debugging, and testing.

## Directory Structure

- **verify/** - One-time verification scripts for completed implementations
- **debug/** - Diagnostic scripts for troubleshooting issues
- **testing/** - Manual testing scripts for API endpoints and features
- **solution-lib.sh** - Shared library functions for solution management

## Quick Access

For frequently-used multi-stage verification:
- `../verify-context-mechanism.sh` - Comprehensive context mechanism verification (kept in root)

## Usage

All scripts are executable. Run from project root:

```bash
# Verification scripts
./tools/verify/api.sh
./tools/verify/skills.sh

# Debug scripts
./tools/debug/file-hook.sh

# Testing scripts
./tools/testing/file-registration.sh
```

## See Also

- Individual README files in each subdirectory for detailed documentation
- `docs/internal/deprecated/` - Archived deprecated scripts
