# Mount `/tmp` on `tmpfs`.
#
# `/tmp` is generally not mounted on `tmpfs` and will incur I/O overhead for
# tmp operations (damaging your SSD if you have one). Most laptop computers
# have enough memory to benefit from this.
#
# See the following resources:
#
#   - http://askubuntu.com/q/62928
#   - http://askubuntu.com/q/173094
#
class base::tmp {

  mount { '/tmp' :
    ensure   => 'mounted',
    atboot   => true,
    device   => 'tmpfs',
    fstype   => 'tmpfs',
    options  => join([
      'defaults',
      'noatime',
      'size=10%',
      'mode=1777',
    ], ','),
  }

}
