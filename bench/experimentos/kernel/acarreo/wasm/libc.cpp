// The few C library functions the freestanding build needs, and the arena.
#include <stddef.h>
extern "C" {
void * memcpy(void * d, const void * s, size_t n) { auto * a = static_cast<unsigned char *>(d); auto * b = static_cast<const unsigned char *>(s); while (n--) *a++ = *b++; return d; }
void * memmove(void * d, const void * s, size_t n) { auto * a = static_cast<unsigned char *>(d); auto * b = static_cast<const unsigned char *>(s); if (a < b) while (n--) *a++ = *b++; else { a += n; b += n; while (n--) *--a = *--b; } return d; }
void * memset(void * d, int c, size_t n) { auto * a = static_cast<unsigned char *>(d); while (n--) *a++ = (unsigned char)c; return d; }
int snprintf(char *, size_t, const char *, ...) { return 0; }   // only mpn_to_string uses it; never called here
static unsigned char arena[4 << 20];
static size_t top = 0;
void * mpn_arena_alloc(size_t bytes) { void * p = arena + top; top += (bytes + 15) & ~size_t(15); if (top > sizeof(arena)) __builtin_trap(); return p; }
__attribute__((export_name("arena_reset"))) void arena_reset() { top = 0; }
}
