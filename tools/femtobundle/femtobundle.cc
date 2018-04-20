#include <unistd.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>

int main(int argc, char** argv) {
  for (int i=1; i<argc; i++) {
    int fd = open(argv[i], O_RDONLY);
    char buf[4096];
    ssize_t bytes = 0;
    while ((bytes = read(fd, &buf, sizeof(buf))) > 0) {
      write(STDOUT_FILENO, &buf, static_cast<size_t>(bytes));
    }
    close(fd);
  }
  return 0;
}
